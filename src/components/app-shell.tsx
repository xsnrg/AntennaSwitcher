import { Link, useRouterState } from "@tanstack/react-router";
import { Radio } from "lucide-react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSwitchStore } from "@/lib/store";

const NAV = [
  { to: "/", label: "Switch" },
  { to: "/wiring", label: "Wiring" },
  { to: "/hardware", label: "Hardware" },
  { to: "/firmware", label: "Firmware" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const snap = useSwitchStore((s) => s.snap);
  const active = snap.ports.find((p) => p.id === snap.activePort);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accent">
                <Radio className="size-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-xs tracking-[0.22em] text-muted uppercase">
                  HF · 1.8–60 MHz · 500 W PEP
                </p>
                <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                  AntennaSwitcher
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill
                switching={snap.switching}
                label={
                  snap.switching
                    ? "BREAK"
                    : active
                      ? `P${active.id} - ${active.name}`
                      : "OPEN"
                }
                dummy={active?.isDummyLoad ?? false}
              />
              <ThemeToggle />
            </div>
          </div>
          <nav
            aria-label="Primary"
            className="-mx-1 flex gap-1 overflow-x-auto pb-0.5"
          >
            {NAV.map((item) => {
              const current =
                item.to === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150",
                    current
                      ? "bg-surface-2 text-fg"
                      : "text-muted hover:bg-surface hover:text-fg",
                  )}
                  aria-current={current ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}

function StatusPill({
  switching,
  label,
  dummy,
}: {
  switching: boolean;
  label: string;
  dummy: boolean;
}) {
  return (
    <span
      data-testid="status-pill"
      className={cn(
        "hidden max-w-48 truncate rounded-full px-3 py-1.5 font-mono text-xs tracking-wide sm:inline-flex",
        switching
          ? "bg-surface-2 text-muted"
          : dummy
            ? "bg-surface-2 text-muted"
            : "bg-accent text-accent-fg",
      )}
    >
      {label}
    </span>
  );
}
