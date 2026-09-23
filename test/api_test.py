#!/usr/bin/env python3
"""API/safety tests for AntennaSwitcher firmware, run against the host
harness (test/harness) which compiles the real sketch against stubbed
Arduino/ESP32 APIs. No hardware needed.

Usage:  python3 test/api_test.py [-v]
Build the harness first:  make -C test/harness
"""

import http.client
import json
import os
import signal
import socket
import subprocess
import sys
import tempfile
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
HARNESS = os.path.join(HERE, "harness", "harness")
RELAY_PIN = {1: 32, 2: 33, 3: 25, 4: 26}


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


class Harness:
    """One harness process with fresh NVS + GPIO log unless nvs_file given."""

    def __init__(self, nvs_file=None, env_extra=None, wait_http=True):
        if not os.path.exists(HARNESS):
            raise SystemExit(
                "harness binary missing; run: make -C test/harness")
        self.tmp = tempfile.TemporaryDirectory(prefix="antsw-qa-")
        self.nvs = nvs_file or os.path.join(self.tmp.name, "nvs.tsv")
        self.gpio = os.path.join(self.tmp.name, "gpio.log")
        self.port = free_port()
        env = dict(os.environ,
                   STUB_PORT=str(self.port),
                   ANTS_NVS_FILE=self.nvs,
                   GPIO_LOG=self.gpio)
        env.pop("STUB_WIFI_DOWN", None)
        if env_extra:
            env.update(env_extra)
        self.proc = subprocess.Popen(
            [HARNESS], env=env,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if wait_http:
            self._wait_ready()

    def _wait_ready(self, timeout=15):
        t0 = time.time()
        while time.time() - t0 < timeout:
            try:
                self.request("GET", "/api/state")
                return
            except (ConnectionRefusedError, OSError):
                time.sleep(0.05)
        raise RuntimeError("harness did not start")

    def request(self, method, path, body=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        headers = {}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if isinstance(body, str):
            body = body.encode("utf-8")  # browsers send UTF-8 bodies
        c.request(method, path, body=body, headers=headers)
        r = c.getresponse()
        data = r.read().decode()
        c.close()
        return r.status, data

    def state(self):
        status, data = self.request("GET", "/api/state")
        assert status == 200, status
        return json.loads(data)

    def select(self, port):
        return self.request("POST", "/api/select", json.dumps({"port": port}))

    def rename(self, port, name):
        # send name pre-escaped (as a real JSON client would)
        return self.request("POST", "/api/rename",
                            json.dumps({"port": port, "name": name}))

    def theme(self, value):
        return self.request("POST", "/api/theme",
                            json.dumps({"theme": value}))

    def gpio_writes(self):
        if not os.path.exists(self.gpio):
            return []
        with open(self.gpio) as f:
            return [tuple(int(x) for x in line.split())
                    for line in f if line.strip()]

    def stop(self, sig=signal.SIGTERM):
        self.proc.send_signal(sig)
        try:
            self.proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.proc.kill()
            self.proc.wait()

    def cleanup(self):
        if self.proc.poll() is None:
            self.proc.kill()
            self.proc.wait()
        self.tmp.cleanup()


class Base(unittest.TestCase):
    def setUp(self):
        self.h = Harness()
        self.addCleanup(self.h.cleanup)


class TestBoot(Base):
    def test_boots_on_dummy_load(self):
        s = self.h.state()
        self.assertEqual(s["activePort"], 1)
        self.assertTrue(s["ports"][0]["isDummyLoad"])
        self.assertEqual(s["lastError"], "none")

    def test_boot_gpio_sequence_all_off_then_port1(self):
        w = self.h.gpio_writes()
        self.assertEqual([v for _, _, v in w[:4]], [0, 0, 0, 0])
        self.assertTrue(any(pin == RELAY_PIN[1] and v == 1
                            for _, pin, v in w[4:]))

    def test_state_json_contract(self):
        s = self.h.state()
        for k in ("activePort", "switching", "operationCount", "errorCount",
                  "lastError", "uptimeMs", "theme", "rssi", "heap", "ip",
                  "railOk", "resetReason", "tempC", "ports"):
            self.assertIn(k, s)
        for i, p in enumerate(s["ports"]):
            for k in ("id", "name", "gpio", "relay", "isDummyLoad",
                      "selectCount", "totalSelectedMs", "lastSelectedAt"):
                self.assertIn(k, p)
            self.assertEqual(p["gpio"], RELAY_PIN[p["id"]])


class TestSelect(Base):
    def test_select_moves_and_counts(self):
        st, _ = self.h.select(2)
        self.assertEqual(st, 200)
        s = self.h.state()
        self.assertEqual(s["activePort"], 2)
        self.assertGreaterEqual(s["operationCount"], 1)

    def test_break_before_make_timing(self):
        self.h.select(3)
        w = self.h.gpio_writes()
        idx = max(i for i, (ms, pin, v) in enumerate(w)
                  if pin == RELAY_PIN[3] and v == 1)
        make_ms = w[idx][0]
        # previously energized coil (port 1 from boot)
        ph_ms, ph_pin = max((ms, pin) for ms, pin, v in w[:idx]
                            if v == 1 and pin != RELAY_PIN[3])
        # electrical break = first LOW on that pin after it was energized
        # (applyPort re-writes redundant LOWs at make time; ignore those)
        break_ms = min(ms for ms, pin, v in w
                       if pin == ph_pin and v == 0 and ms > ph_ms)
        gap = make_ms - break_ms
        self.assertGreaterEqual(gap, 70)  # 80 ms break-before-make window
        self.assertLess(gap, 200)
        # no coil may be energized inside the break window
        self.assertFalse([1 for ms, _, v in w[:idx]
                          if v == 1 and break_ms < ms < make_ms])

    def test_select_same_port_is_idempotent(self):
        self.h.select(2)
        w_before = len(self.h.gpio_writes())
        st, _ = self.h.select(2)
        self.assertEqual(st, 200)
        self.assertEqual(len(self.h.gpio_writes()), w_before)

    def test_invalid_port_parks_on_dummy(self):
        self.h.select(3)
        st, _ = self.h.select(9)
        self.assertEqual(st, 400)
        s = self.h.state()
        self.assertEqual(s["activePort"], 1)
        self.assertEqual(s["lastError"], "invalid port")

    def test_fault_endpoint_parks_on_dummy(self):
        self.h.select(4)
        st, _ = self.h.request("POST", "/api/fault")
        self.assertEqual(st, 200)
        s = self.h.state()
        self.assertEqual(s["activePort"], 1)
        self.assertEqual(s["lastError"], "http fault")


class TestRename(Base):
    def test_rename_persists_across_restart(self):
        st, _ = self.h.rename(2, "Dipole 20m")
        self.assertEqual(st, 200)
        nvs = self.h.nvs
        self.h.stop()
        self.h2 = Harness(nvs_file=nvs)
        self.addCleanup(self.h2.cleanup)
        self.assertEqual(self.h2.state()["ports"][1]["name"], "Dipole 20m")

    def test_name_truncated_to_32(self):
        self.h.rename(3, "A" * 40)
        self.assertEqual(len(self.h.state()["ports"][2]["name"]), 32)

    def test_utf8_truncation_keeps_state_json_valid(self):
        # QA-2-1: 31 ASCII + 2-byte é = 33 bytes; a byte-cap at 32 must
        # drop the split char, not emit invalid UTF-8 (browser r.json())
        body = json.dumps({"port": 2, "name": "A" * 31 + "é"},
                          ensure_ascii=False)
        st, _ = self.h.request("POST", "/api/rename", body)
        self.assertEqual(st, 200)
        s = self.h.state()  # raises UnicodeDecodeError if payload invalid
        self.assertEqual(s["ports"][1]["name"], "A" * 31)

    def test_rejected_rename_does_not_move_relays(self):
        # QA-1-2: empty name is an input error, not an RF fault
        self.h.select(3)
        w_before = len(self.h.gpio_writes())
        st, _ = self.h.rename(2, "")
        self.assertEqual(st, 400)
        s = self.h.state()
        self.assertEqual(s["activePort"], 3)
        self.assertEqual(len(self.h.gpio_writes()), w_before)

    def test_quotes_and_backslashes_roundtrip(self):
        # QA-1-3: parseJsonString must honor JSON escapes
        name = '20m "special"\\dipole'
        st, _ = self.h.rename(3, name)
        self.assertEqual(st, 200)
        self.assertEqual(self.h.state()["ports"][2]["name"], name)


class TestXss(Base):
    def test_port_names_html_escaped_in_ui(self):
        # QA-1-1: the embedded UI must escape port names before innerHTML
        self.h.rename(3, '<img src=x onerror=window.__x=1>')
        st, html = self.h.request("GET", "/")
        self.assertEqual(st, 200)
        self.assertIn("const esc =", html)
        # render() must pass names/lastError through esc()
        for frag in ("esc(p.name)", "esc(state.lastError)"):
            self.assertIn(frag, html)

    def test_names_not_mangled_in_state_json(self):
        # escaping belongs to the UI, not the stored value
        self.h.rename(2, "a<b>&\"c\"")
        self.assertEqual(self.h.state()["ports"][1]["name"], "a<b>&\"c\"")


class TestTheme(Base):
    def test_valid_theme_persists(self):
        st, _ = self.h.theme("dark")
        self.assertEqual(st, 200)
        nvs = self.h.nvs
        self.h.stop()
        self.h2 = Harness(nvs_file=nvs)
        self.addCleanup(self.h2.cleanup)
        self.assertEqual(self.h2.state()["theme"], "dark")

    def test_invalid_theme_rejected(self):
        # QA-1-5
        self.h.theme("dark")
        st, _ = self.h.theme("neon")
        self.assertEqual(st, 400)
        self.assertEqual(self.h.state()["theme"], "dark")


class TestCors(Base):
    def test_options_preflight_on_all_post_endpoints(self):
        # QA-1-6
        for path in ("/api/select", "/api/rename", "/api/theme",
                     "/api/fault"):
            st, _ = self.h.request("OPTIONS", path)
            self.assertEqual(st, 204, path)


class TestSafetyInvariants(Base):
    def test_shutdown_parks_on_port1(self):
        self.h.select(3)
        self.h.stop()
        w = self.h.gpio_writes()
        tail = w[-4:]
        self.assertEqual(sorted((pin, v) for _, pin, v in tail),
                         sorted([(32, 1), (33, 0), (25, 0), (26, 0)]))

    def test_wdt_fed_during_wifi_wait(self):
        # WiFi never connects: setup blocks up to 20 s feeding the task WDT;
        # the sketch must already have parked on port 1 and still be alive.
        self.h.stop()
        h = Harness(nvs_file=self.h.nvs, env_extra={"STUB_WIFI_DOWN": "1"},
                    wait_http=False)
        self.addCleanup(h.cleanup)
        time.sleep(3)
        self.assertIsNone(h.proc.poll())  # alive: watchdog fed
        self.assertTrue(any(pin == RELAY_PIN[1] and v == 1
                            for _, pin, v in h.gpio_writes()))


if __name__ == "__main__":
    unittest.main(verbosity=2)
