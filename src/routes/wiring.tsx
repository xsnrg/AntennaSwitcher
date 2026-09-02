import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { WiringDiagram } from "@/components/wiring-diagram";

export const Route = createFileRoute("/wiring")({ component: WiringPage });

function WiringPage() {
  return (
    <AppShell>
      <article className="flex max-w-4xl flex-col gap-6">
        <header>
          <p className="font-mono text-xs tracking-[0.18em] text-muted uppercase">
            Physical plan
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Wiring
          </h2>
          <p className="mt-2 max-w-prose text-muted">
            The AT-14 carries RF. The ESP32 board only switches +12 V control.
            Port 1 is a 50 ohm dummy load. Only one control line may be hot.
          </p>
        </header>

        <WiringDiagram />

        <section className="rounded-xl bg-surface p-5 shadow-border">
          <h3 className="text-lg font-semibold">Rules</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>
              TX connects to exactly one AT-14 antenna port at rest. During a
              changeover every coil is open for 80 ms (break-before-make).
            </li>
            <li>
              Port 1 is a dummy load. Firmware boots there, returns there on
              every trapped error, and parks there on shutdown.
            </li>
            <li>
              Feed +12 V through the ESP32 relays in an NC daisy-chain so two
              AT-14 coils cannot energize even if two GPIOs glitch high.
            </li>
            <li>
              Power the ESP32 from the shack 13.8 V supply on the 7–30 V
              terminals. Never apply AC mains and DC at the same time.
            </li>
          </ol>
        </section>

        <section className="rounded-xl bg-surface p-5 shadow-border">
          <h3 className="text-lg font-semibold">Control cable</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-md text-left text-sm">
              <thead className="font-mono text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="pb-2">AT-14 pin</th>
                  <th className="pb-2">ESP32 relay</th>
                  <th className="pb-2">GPIO</th>
                  <th className="pb-2">Load</th>
                </tr>
              </thead>
              <tbody className="text-fg">
                <Row pin="GND" relay="DC GND" gpio="—" load="PSU return" />
                <Row pin="1" relay="R1 NO" gpio="32" load="50 Ω dummy" />
                <Row pin="2" relay="R2 NO" gpio="33" load="Antenna 2" />
                <Row pin="3" relay="R3 NO" gpio="25" load="Antenna 3" />
                <Row pin="4" relay="R4 NO" gpio="26" load="Antenna 4" />
              </tbody>
            </table>
          </div>
        </section>
        <section className="rounded-xl bg-surface p-5 shadow-border">
          <h3 className="text-lg font-semibold">Rails</h3>
          <p className="mt-2 text-sm text-muted">
            This board has no ADC tap on 5 V or 3.3 V. 5 V would destroy a GPIO
            if you probed it directly. The ESP32 brownout detector watches the
            3.3 V rail and records that as the last reset reason. Die
            temperature and WiFi RSSI need no extra parts.
          </p>
        </section>
      </article>
    </AppShell>
  );
}

function Row({
  pin,
  relay,
  gpio,
  load,
}: {
  pin: string;
  relay: string;
  gpio: string;
  load: string;
}) {
  return (
    <tr className="border-t border-border">
      <td className="py-2 font-mono">{pin}</td>
      <td className="py-2 font-mono">{relay}</td>
      <td className="py-2 font-mono">{gpio}</td>
      <td className="py-2">{load}</td>
    </tr>
  );
}
