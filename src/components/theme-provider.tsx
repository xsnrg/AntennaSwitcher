import { useEffect, type ReactNode } from "react";
import { useSwitchStore } from "@/lib/store";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSwitchStore((s) => s.snap.theme);
  const hydrate = useSwitchStore((s) => s.hydrate);
  const tick = useSwitchStore((s) => s.tick);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [tick]);

  return children;
}
