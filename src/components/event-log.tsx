import { formatClock, type SwitchEvent } from "@/lib/switch-engine";

export function EventLog({
  events,
  now,
}: {
  events: SwitchEvent[];
  now: number;
}) {
  return (
    <section
      data-testid="event-log"
      className="rounded-xl bg-surface p-4 shadow-border"
    >
      <h2 className="mb-3 font-mono text-xs tracking-[0.18em] text-muted uppercase">
        Switch log
      </h2>
      <ol className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {events.map((event) => (
          <li
            key={event.id}
            className="border-b border-border pb-2 last:border-0 last:pb-0"
          >
            <p className="text-sm text-fg">{event.message}</p>
            <p className="font-mono text-xs text-subtle">
              {formatClock(event.at, now)}
              {event.port ? ` · port ${event.port}` : ""}
              {" · "}
              {event.kind}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
