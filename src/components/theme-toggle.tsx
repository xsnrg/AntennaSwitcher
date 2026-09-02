import { Monitor, Moon, Sun, Circle } from "lucide-react";
import { cn } from "@/lib/cn";
import { useSwitchStore } from "@/lib/store";
import type { ThemeId } from "@/lib/switch-engine";

const OPTIONS: { id: ThemeId; label: string; icon: typeof Sun }[] = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "grey", label: "Grey", icon: Circle },
];

export function ThemeToggle() {
  const theme = useSwitchStore((s) => s.snap.theme);
  const setTheme = useSwitchStore((s) => s.setTheme);

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="flex rounded-lg bg-surface-2 p-1"
      data-testid="theme-toggle"
    >
      {OPTIONS.map(({ id, label, icon: Icon }) => {
        const selected = theme === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setTheme(id)}
            className={cn(
              "flex size-9 items-center justify-center rounded-md transition-[background-color,color,transform] duration-150 ease-out",
              "active:scale-[0.96]",
              selected
                ? "bg-surface text-fg shadow-border"
                : "text-muted hover:text-fg",
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}
