import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/hardware")({ component: HardwarePage });

function HardwarePage() {
  return (
    <AppShell>
      <article className="flex max-w-4xl flex-col gap-8">
        <header>
          <p className="font-mono text-xs tracking-[0.18em] text-muted uppercase">
            Device research
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Hardware
          </h2>
          <p className="mt-2 max-w-prose text-muted">
            Two Amazon parts. The ESP32 board is the WiFi controller and 12 V
            interposer. The AT-14 is the RF switch. Full notes live in
            docs/HARDWARE.md in the GitHub repo.
          </p>
        </header>

        <Device
          asin="B0DCZ549VQ"
          href="https://www.amazon.com/dp/B0DCZ549VQ"
          image="/hardware/esp32-relay-board.jpg"
          imageAlt="ESP32-WROOM-32E four-relay development board with AC/DC power supply, front and back"
          title="AC/DC Power Supply ESP32 Dev Board"
          subtitle="ESP32-WROOM-32E · 4 × SONGLE SRD-05VDC-SL-C"
          facts={[
            ["Power", "AC 90–250 V or DC 7–30 V (use shack 13.8 V)"],
            ["MCU", "ESP32-WROOM-32E, 4 MB flash, WiFi + BT"],
            ["Relays", "4 ch, 10 A @ 250 VAC / 30 VDC, COM/NO/NC"],
            ["GPIO map", "R1=32, R2=33, R3=25, R4=26 (verify)"],
            ["Sensors", "Die temp + 3.3 V brownout detector; 5 V not sensed"],
            ["Program", "UART header + RST; 3.3 V USB-serial"],
          ]}
        >
          Onboard AC-DC module, 5 V rail for the ESP32 and relay coils, every
          GPIO broken out, silkscreen ESP32_Relay_4. Contacts switch the AT-14
          control voltage — not RF.
        </Device>

        <Device
          asin="B0DY7K5KSN"
          href="https://www.amazon.com/dp/B0DY7K5KSN"
          image="/hardware/at14-switch.jpg"
          imageAlt="AT-14 4-way coaxial remote antenna switch with SO-239 ports and rotary controller"
          title="AT-14 4-way coaxial antenna switch"
          subtitle="1.8–60 MHz · 500 W PEP · SO-239"
          facts={[
            ["RF ports", "TX center, antennas 1–4, UHF female"],
            ["Control", "+12 V one-hot, 4 lines + GND"],
            ["Kit", "Outdoor switch + optional rotary head"],
            ["Size", "≈ 10 × 11.5 × 3.5 cm (switch body)"],
            ["Default", "No coil voltage = TX disconnected"],
          ]}
        >
          Heavy-duty 1×4 remote switch covering 160 m through 6 m. The included
          rotary box is unused — the ESP32 drives the four 12 V lines instead.
          Put a dummy load on port 1.
        </Device>
      </article>
    </AppShell>
  );
}

function Device({
  asin,
  href,
  image,
  imageAlt,
  title,
  subtitle,
  facts,
  children,
}: {
  asin: string;
  href: string;
  image: string;
  imageAlt: string;
  title: string;
  subtitle: string;
  facts: [string, string][];
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-surface shadow-border">
      <img
        src={image}
        alt={imageAlt}
        className="h-56 w-full object-contain bg-surface-2 outline outline-1 -outline-offset-1 outline-fg/10"
      />
      <div className="p-5">
        <p className="font-mono text-xs text-muted">ASIN {asin}</p>
        <h3 className="mt-1 text-xl font-semibold tracking-tight">{title}</h3>
        <p className="text-sm text-muted">{subtitle}</p>
        <p className="mt-3 max-w-prose text-sm text-muted">{children}</p>
        <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {facts.map(([k, v]) => (
            <div key={k} className="rounded-lg bg-surface-2 px-3 py-2">
              <dt className="font-mono text-xs text-subtle">{k}</dt>
              <dd className="text-sm">{v}</dd>
            </div>
          ))}
        </dl>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-accent"
        >
          Amazon listing
        </a>
      </div>
    </section>
  );
}
