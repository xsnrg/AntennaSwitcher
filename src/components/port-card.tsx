import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatClock, formatDuration, type PortRecord } from "@/lib/switch-engine";
import { useSwitchStore } from "@/lib/store";

export function PortCard({ port, now, switching }: {
  port: PortRecord;
  now: number;
  switching: boolean;
}) {
  const activePort = useSwitchStore((s) => s.snap.activePort);
  const select = useSwitchStore((s) => s.select);
  const rename = useSwitchStore((s) => s.rename);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(port.name);
  const selected = activePort === port.id && !switching;

  function commit() {
    rename(port.id, draft);
    setEditing(false);
  }

  return (
    <article
      data-testid={`port-card-${port.id}`}
      data-selected={selected ? "true" : "false"}
      className={cn(
        "flex flex-col rounded-xl bg-surface p-4 shadow-border transition-[box-shadow,transform] duration-150",
        selected && "ring-2 ring-accent ring-offset-2 ring-offset-bg",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs tracking-[0.18em] text-muted uppercase">
            Port {port.id}
            {port.isDummyLoad ? " · Dummy" : ""}
          </p>
          {editing ? (
            <form
              className="mt-1"
              onSubmit={(e) => {
                e.preventDefault();
                commit();
              }}
            >
              <input
                data-testid={`port-name-input-${port.id}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                autoFocus
                maxLength={32}
                aria-label={`Name for port ${port.id}`}
                className="w-full rounded-md bg-surface-2 px-2 py-1 text-base font-medium text-fg outline-none ring-2 ring-accent"
              />
            </form>
          ) : (
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight">
              {port.name}
            </h2>
          )}
        </div>
        <button
          type="button"
          aria-label={`Rename port ${port.id}`}
          data-testid={`port-rename-${port.id}`}
          onClick={() => {
            setDraft(port.name);
            setEditing(true);
          }}
          className="flex size-11 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          {editing ? <Check className="size-4" /> : <Pencil className="size-4" />}
        </button>
      </div>

      <dl className="mb-4 grid grid-cols-3 gap-2 font-mono text-xs text-muted">
        <div>
          <dt className="text-subtle">GPIO</dt>
          <dd className="tabular-nums text-fg">{port.gpio}</dd>
        </div>
        <div>
          <dt className="text-subtle">Selects</dt>
          <dd className="tabular-nums text-fg" data-testid={`port-selects-${port.id}`}>
            {port.selectCount}
          </dd>
        </div>
        <div>
          <dt className="text-subtle">On time</dt>
          <dd className="tabular-nums text-fg" data-testid={`port-time-${port.id}`}>
            {formatDuration(port.totalSelectedMs)}
          </dd>
        </div>
      </dl>

      <p className="mb-4 font-mono text-xs text-subtle">
        Last {formatClock(port.lastSelectedAt, now)}
        {" · "}Relay {port.relay}
      </p>

      <button
        type="button"
        data-testid={`port-select-${port.id}`}
        disabled={switching || selected}
        onClick={() => void select(port.id)}
        className={cn(
          "mt-auto flex min-h-11 w-full items-center justify-center rounded-lg text-sm font-medium tracking-wide transition-[background-color,color,transform] duration-150 ease-out",
          "active:enabled:scale-[0.96]",
          selected
            ? "bg-accent text-accent-fg"
            : "bg-surface-2 text-fg hover:bg-fg hover:text-bg",
          switching && "opacity-60",
        )}
      >
        {selected ? "Selected" : switching ? "Switching" : "Select"}
      </button>
    </article>
  );
}
