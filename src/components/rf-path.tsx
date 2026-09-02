import { cn } from "@/lib/cn";
import { useSwitchStore } from "@/lib/store";

export function RfPath() {
  const snap = useSwitchStore((s) => s.snap);
  const active = snap.ports.find((p) => p.id === snap.activePort);
  const connected = snap.switching
    ? "OPEN"
    : active
      ? `P${active.id} - ${active.name}`
      : "OPEN";

  return (
    <section
      data-testid="rf-path"
      className="rounded-xl bg-surface px-4 py-4 shadow-border sm:px-5"
      aria-label="RF path"
    >
      <p className="mb-3 font-mono text-xs tracking-[0.18em] text-muted uppercase">
        RF path · TX to one port only
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Node label="Radio" />
        <Dash live={!snap.switching} />
        <Node label="TX" live={!snap.switching} />
        <Dash live={!snap.switching} />
        <Node
          label={connected}
          live={!snap.switching}
          accent={!snap.switching}
          wide
        />
      </div>
    </section>
  );
}

function Node({
  label,
  live,
  accent,
  wide,
}: {
  label: string;
  live?: boolean;
  accent?: boolean;
  wide?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-9 max-w-full items-center rounded-md px-2.5 font-medium",
        wide && "truncate",
        accent
          ? "bg-accent text-accent-fg"
          : live
            ? "bg-surface-2 text-fg"
            : "bg-surface-2 text-muted",
      )}
    >
      {label}
    </span>
  );
}

function Dash({ live }: { live: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "h-px w-5 sm:w-8",
        live ? "bg-accent" : "bg-border",
      )}
    />
  );
}
