import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { BoardMetrics } from "@/components/board-metrics";
import { EventLog } from "@/components/event-log";
import { PortCard } from "@/components/port-card";
import { RfPath } from "@/components/rf-path";
import { useSwitchStore } from "@/lib/store";
import { formatDuration } from "@/lib/switch-engine";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const snap = useSwitchStore((s) => s.snap);
  const simulateFault = useSwitchStore((s) => s.simulateFault);
  const uptime = snap.now - snap.startedAt;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <RfPath />
        <BoardMetrics />

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {snap.ports.map((port) => (
            <PortCard
              key={port.id}
              port={port}
              now={snap.now}
              switching={snap.switching}
            />
          ))}
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
          <section className="rounded-xl bg-surface p-4 shadow-border">
            <h2 className="mb-3 font-mono text-xs tracking-[0.18em] text-muted uppercase">
              Console stats
            </h2>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Uptime" value={formatDuration(uptime)} />
              <Stat label="Operations" value={String(snap.operationCount)} testId="stat-ops" />
              <Stat label="Errors" value={String(snap.errorCount)} testId="stat-errors" />
              <Stat
                label="Last error"
                value={snap.lastError ?? "none"}
                testId="stat-last-error"
              />
            </dl>
            <p className="mt-4 max-w-prose text-sm text-muted">
              TX is connected to exactly one port. Switching opens every relay
              for 80 ms before closing the next. Any fault returns the path to
              port 1, the 50 ohm dummy load.
            </p>
            <button
              type="button"
              data-testid="simulate-fault"
              onClick={() => void simulateFault()}
              className="mt-4 min-h-11 rounded-lg bg-surface-2 px-4 text-sm font-medium text-fg transition-[background-color,transform] duration-150 active:scale-[0.96] hover:bg-fg hover:text-bg"
            >
              Simulate fault
            </button>
          </section>
          <EventLog events={snap.events} now={snap.now} />
        </div>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd
        data-testid={testId}
        className="mt-1 font-mono text-sm text-fg tabular-nums break-words"
      >
        {value}
      </dd>
    </div>
  );
}
