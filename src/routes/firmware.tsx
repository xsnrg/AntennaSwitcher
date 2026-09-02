import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/firmware")({ component: FirmwarePage });

function FirmwarePage() {
  return (
    <AppShell>
      <article className="flex max-w-3xl flex-col gap-6">
        <header>
          <p className="font-mono text-xs tracking-[0.18em] text-muted uppercase">
            ESP32
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Flash and setup
          </h2>
          <p className="mt-2 max-w-prose text-muted">
            One Arduino sketch. Flash over the UART header, then wire 13.8 V
            control and RF. Full copy lives in README.md on GitHub.
          </p>
        </header>

        <section className="rounded-xl bg-surface p-5 shadow-border">
          <h3 className="text-lg font-semibold">You need</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
            <li>Arduino IDE 2 and the Espressif esp32 board package.</li>
            <li>3.3 V USB-serial adapter (not 5 V logic).</li>
            <li>
              firmware/AntennaSwitcher.ino with WIFI_SSID and WIFI_PASS set.
            </li>
          </ul>
        </section>

        <section className="rounded-xl bg-surface p-5 shadow-border">
          <h3 className="text-lg font-semibold">Flash</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>
              Boards Manager URL:
              espressif.github.io/arduino-esp32/package_esp32_index.json
            </li>
            <li>Board: ESP32 Dev Module, flash 4 MB, upload 115200.</li>
            <li>
              Adapter GND to GND, TX to board RX, RX to board TX. Power 3.3 V
              only. Leave AC L/N empty.
            </li>
            <li>
              Hold IO0 to GND, tap RST, release IO0, then upload
              firmware/AntennaSwitcher.ino.
            </li>
            <li>
              Serial Monitor at 115200 prints the station IP. Open that address
              or http://antennaswitcher.local/
            </li>
          </ol>
        </section>

        <section className="rounded-xl bg-surface p-5 shadow-border">
          <h3 className="text-lg font-semibold">Setup after flash</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>
              Shack 13.8 V on the ESP32 7–30 V and GND screws. Never AC and DC
              together.
            </li>
            <li>
              Daisy-chain +12 V through R1–R4 NC so only one AT-14 coil can
              energize. NO lines go to AT-14 pins 1–4. GND common.
            </li>
            <li>
              Radio to AT-14 TX. Port 1 to a 50 Ω dummy load. Ports 2–4 to
              antennas.
            </li>
            <li>
              Power up: firmware must select port 1. Unkey, tap another port,
              confirm a single coil, then check SWR.
            </li>
          </ol>
        </section>

        <section className="rounded-xl bg-surface p-5 shadow-border">
          <h3 className="text-lg font-semibold">Board sensors</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
            <li>
              3.3 V rail: brownout detector only. The page shows OK plus the
              last reset reason (power-on, brownout, watchdog, panic). Not a
              voltmeter.
            </li>
            <li>
              5 V coil rail and the 7–30 V input are not on an ADC. Measuring
              them needs a divider; this build does not add one.
            </li>
            <li>
              Die temperature: ESP32-WROOM-32E on-chip sensor. Typically
              10–20 °C above the box. Warns at 70 °C (chip rated 85 °C).
            </li>
            <li>WiFi RSSI and free heap from the core. No extra wiring.</li>
          </ul>
        </section>

        <section className="rounded-xl bg-surface p-5 shadow-border">
          <h3 className="text-lg font-semibold">Fail-safe</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
            <li>Boot always selects port 1.</li>
            <li>Break-before-make, 80 ms open interval.</li>
            <li>Watchdog and shutdown hook both drive port 1.</li>
            <li>Invalid API values are rejected and the path returns to 1.</li>
            <li>GPIO map is a compile-time array matching ESP32_Relay_4.</li>
          </ul>
        </section>

        <section className="rounded-xl bg-surface p-5 shadow-border">
          <h3 className="text-lg font-semibold">This preview</h3>
          <p className="mt-2 text-sm text-muted">
            The Switch tab is a lab simulator of that firmware: same exclusive
            relay model, same dummy-load policy, same four themes. It cannot
            move real RF. Flash the sketch to the board for on-air use.
          </p>
        </section>
      </article>
    </AppShell>
  );
}
