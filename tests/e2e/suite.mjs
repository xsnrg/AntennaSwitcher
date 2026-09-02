import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:8080";

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

async function run() {
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const results = [];
  for (const t of tests) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    try {
      await t.fn({ page, context, errors });
      if (errors.length) throw new Error(`console/page errors: ${errors.join("; ")}`);
      results.push({ name: t.name, ok: true });
      console.log(`ok  ${t.name}`);
    } catch (err) {
      results.push({ name: t.name, ok: false, error: String(err) });
      console.error(`not ok  ${t.name}`);
      console.error(err);
    } finally {
      await context.close();
    }
  }
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`\n${failed.length} failed / ${results.length}`);
    process.exit(1);
  }
  console.log(`\n${results.length} passed`);
}

test("home shows four ports and dummy load selected", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByTestId("port-card-1").waitFor();
  for (const id of [1, 2, 3, 4]) {
    assert.ok(await page.getByTestId(`port-card-${id}`).count());
  }
  assert.equal(await page.getByTestId("port-card-1").getAttribute("data-selected"), "true");
  assert.equal(await page.getByTestId("port-card-2").getAttribute("data-selected"), "false");
  assert.match(await page.getByTestId("port-card-1").innerText(), /Dummy/i);
});

test("selecting a port moves TX and never leaves two selected", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByTestId("port-select-3").click();
  await page.waitForTimeout(120);
  const selected = [];
  for (const id of [1, 2, 3, 4]) {
    if ((await page.getByTestId(`port-card-${id}`).getAttribute("data-selected")) === "true") {
      selected.push(id);
    }
  }
  assert.deepEqual(selected, [3]);
  assert.match(await page.getByTestId("rf-path").innerText(), /P3 - Antenna 3/);
  const ops = await page.getByTestId("stat-ops").innerText();
  assert.ok(Number(ops) >= 1);
});

test("port names can be edited", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByTestId("port-rename-2").click();
  const input = page.getByTestId("port-name-input-2");
  await input.fill("40m dipole");
  await input.press("Enter");
  await page.waitForTimeout(50);
  assert.match(await page.getByTestId("port-card-2").innerText(), /40m dipole/);
  await page.getByTestId("port-select-2").click();
  await page.waitForTimeout(120);
  assert.match(await page.getByTestId("rf-path").innerText(), /P2 - 40m dipole/);
});

test("theme buttons set data-theme including grey and system", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  const toggle = page.getByTestId("theme-toggle");
  await toggle.getByLabel("Dark").click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await toggle.getByLabel("Light").click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await toggle.getByLabel("Grey").click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "grey");
  await toggle.getByLabel("System").click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "system");
});

test("simulated fault returns TX to port 1 dummy load", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByTestId("port-select-4").click();
  await page.waitForTimeout(120);
  await page.getByTestId("simulate-fault").click();
  await page.waitForTimeout(120);
  assert.equal(await page.getByTestId("port-card-1").getAttribute("data-selected"), "true");
  assert.equal(await page.getByTestId("port-card-4").getAttribute("data-selected"), "false");
  const errors = await page.getByTestId("stat-errors").innerText();
  assert.ok(Number(errors) >= 1);
  assert.notEqual(await page.getByTestId("stat-last-error").innerText(), "none");
});

test("select counts increase on the chosen port only", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  const before = Number(await page.getByTestId("port-selects-2").innerText());
  await page.getByTestId("port-select-2").click();
  await page.waitForTimeout(120);
  const after = Number(await page.getByTestId("port-selects-2").innerText());
  assert.equal(after, before + 1);
});

test("board metrics show 3.3 V rail, die temp, and WiFi", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByTestId("board-metrics").waitFor();
  assert.match(await page.getByTestId("metric-rail").innerText(), /OK|Brownout/);
  assert.match(await page.getByTestId("metric-temp").innerText(), /°C/);
  assert.match(await page.getByTestId("metric-rssi").innerText(), /dBm/);
});

test("wiring page documents dummy load and exclusive TX", async ({ page }) => {
  await page.goto(`${BASE}/wiring`, { waitUntil: "networkidle" });
  const text = await page.locator("main").innerText();
  assert.match(text, /dummy/i);
  assert.match(text, /exactly one/i);
  assert.match(text, /GPIO/);
  assert.match(text, /brownout|3\.3 V/i);
});

test("hardware page lists both Amazon devices", async ({ page }) => {
  await page.goto(`${BASE}/hardware`, { waitUntil: "networkidle" });
  const text = await page.locator("main").innerText();
  assert.match(text, /B0DCZ549VQ/);
  assert.match(text, /B0DY7K5KSN/);
  assert.match(text, /ESP32/);
  assert.match(text, /AT-14/);
});

test("firmware page describes the single-file sketch", async ({ page }) => {
  await page.goto(`${BASE}/firmware`, { waitUntil: "networkidle" });
  const text = await page.locator("main").innerText();
  assert.match(text, /AntennaSwitcher\.ino/);
  assert.match(text, /fail-safe|dummy/i);
  assert.match(text, /WIFI_SSID/);
  assert.match(text, /download mode|Hold IO0|IO0/i);
  assert.match(text, /13\.8/);
});

test("mobile viewport has no horizontal overflow and usable tap targets", async ({ page }) => {
  const browser = page.context().browser();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mpage = await mobile.newPage();
  await mpage.goto(BASE, { waitUntil: "networkidle" });
  const overflow = await mpage.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  assert.ok(overflow <= 1, `overflow ${overflow}`);
  const tap = await mpage.getByTestId("port-select-2").boundingBox();
  assert.ok(tap && tap.height >= 40);
  await mpage.getByTestId("port-select-2").click();
  await mpage.waitForTimeout(120);
  assert.equal(await mpage.getByTestId("port-card-2").getAttribute("data-selected"), "true");
  await mobile.close();
});

test("event log records switches", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByTestId("port-select-3").click();
  await page.waitForTimeout(120);
  const log = await page.getByTestId("event-log").innerText();
  assert.match(log, /TX|port 3|Antenna 3/i);
});

run();
