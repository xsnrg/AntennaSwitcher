# AGENTS.md

ESP32 firmware for a 4-port HF antenna switch (AC/DC relay board B0DCZ549VQ +
AT-14 1×4 coax switch), plus a browser "lab console" that simulates the same
switching rules. The firmware is one Arduino sketch; docs are research, not
build inputs.

## Layout

- `firmware/AntennaSwitcher.ino` — the actual product: relay control, HTTP
  server, and the full web UI (embedded `INDEX_HTML` PROGMEM string). No
  libraries beyond the ESP32 core (`WiFi`, `WebServer`, `Preferences`,
  `ESPmDNS`).
- `src/`, `package.json`, `vite.config.ts`, `tests/e2e/` — the lab console
  (Vite + TypeScript + auth/pglite). Simulation only: it does **not** touch
  RF. `src/lib/switch-engine.ts` mirrors the firmware rules (port 1 failsafe,
  break-before-make, GPIO map, themes) — keep it consistent with the `.ino`.
- `README.md`, `docs/HARDWARE.md`, `docs/WIRING.md` — hardware truth. Keep any
  GPIO/relay-logic change consistent across all files that encode it
  (`.ino`, `switch-engine.ts`, README, both docs).

## Toolchains (split reality)

- **Firmware: no CLI toolchain.** `arduino-cli` is not installed; no build or
  lint for the `.ino`. Verify by reading + flashing through **Arduino IDE 2**
  (board: *ESP32 Dev Module*, Flash Size 4 MB, upload 115200) — see README
  §Flash. The host test harness (`test/harness/`, run via `make -C
  test/harness` then `python3 test/api_test.py`) compiles the real sketch
  against stubs and is the only automated firmware check.
- **Lab console: standard npm.** `npm test` (node --test),
  `npm run typecheck`, `npm run lint`, `npm run test:e2e`,
  `npm run dev` (port 8080).

## Safety invariants (do not break)

1. TX connects to exactly one port at rest; port 1 is the 50 Ω dummy load.
2. Changeover is break-before-make: open all coils, wait
   `BREAK_BEFORE_MAKE_MS` (80 ms), close one (`selectPort()`).
3. Every RF fault path parks on port 1: `failsafe()`, the
   `esp_register_shutdown_handler`, WDT reset, and boot all force relay 1.
   Input-validation rejections (`noteError()` from `/api/rename`,
   `/api/theme`) only set `errorCount`/`lastError` — they must NOT move
   relays (an empty name is not an RF emergency).
4. Hardware mutex relies on firmware never energizing two relays at once
   (+12 V daisy-chains through NC). Preserve `switching` reentrancy guard.

Changes touching `selectPort`/`failsafe`/`shutdownHook`/`applyPort` control
real 500 W PEP RF hardware — keep these four invariants explicit in review.

## Firmware gotchas

- GPIO map: relays 1–4 = GPIO 32, 33, 25, 26, **active HIGH**
  (`RELAY_PINS`, `RELAY_ACTIVE_HIGH`). Matches the LC Technology Tasmota
  template; the Tech Minds reference build was active LOW — do not "fix" it.
- WiFi creds are compile-time `WIFI_SSID`/`WIFI_PASS` defines, wrapped in
  `#ifndef` so `-D` build flags can override; not stored in NVS.
- Persistence: `Preferences` namespace `"antsw"` (keys `n1`–`n4`, `theme`).
- JSON is hand-rolled both ways (`stateJson()`, `parseJsonInt/String`) —
  no ArduinoJson. `stateJson()` output is the API contract with the embedded
  JS; change both together. Endpoints: `GET /api/state`; `POST /api/select`,
  `/api/rename`, `/api/theme`, `/api/fault`. UI polls state every 1 s — keep
  the payload small.
- Task watchdog is 8 s (`WDT_TIMEOUT_S`); any new blocking loop >~1 s must
  call `esp_task_wdt_reset()`.
- The board has no ADC tap on 5 V or VIN, and 5 V on a GPIO kills the ESP32.
  A VIN divider was tried and removed (commit `a074b34`) — do not reintroduce
  a fake voltmeter. 3.3 V "rail health" is only the brownout reset reason.

## Git

Push to `master` (repo default). Stale `origin/main` (pre-restart duplicate)
was deleted; do not recreate it.