import { create } from "zustand";
import {
  SwitchEngine,
  type SwitchSnapshot,
  type ThemeId,
  THEME_IDS,
} from "@/lib/switch-engine";

const NAMES_KEY = "antennaswitcher.names";
const THEME_KEY = "antennaswitcher.theme";

function readStoredNames(): string[] | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(NAMES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 4) return null;
    return parsed.map((n) => String(n));
  } catch {
    return null;
  }
}

function readStoredTheme(): ThemeId {
  if (typeof localStorage === "undefined") return "system";
  const raw = localStorage.getItem(THEME_KEY);
  if (raw && (THEME_IDS as string[]).includes(raw)) return raw as ThemeId;
  return "system";
}

function persistNames(snap: SwitchSnapshot) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    NAMES_KEY,
    JSON.stringify(snap.ports.map((p) => p.name)),
  );
}

function persistTheme(theme: ThemeId) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
}

const engine = new SwitchEngine();

export interface SwitchStore {
  snap: SwitchSnapshot;
  hydrated: boolean;
  hydrate: () => void;
  select: (port: number) => Promise<void>;
  rename: (port: number, name: string) => void;
  setTheme: (theme: ThemeId) => void;
  simulateFault: () => Promise<void>;
  tick: () => void;
}

export const useSwitchStore = create<SwitchStore>((set) => {
  engine.subscribe(() => set({ snap: engine.snapshot() }));
  return {
    snap: engine.snapshot(),
    hydrated: false,
    hydrate: () => {
      const theme = readStoredTheme();
      engine.setTheme(theme);
      const names = readStoredNames();
      if (names) names.forEach((name, i) => engine.rename(i + 1, name));
      set({ hydrated: true, snap: engine.snapshot() });
    },
    select: async (port) => {
      await engine.select(port);
    },
    rename: (port, name) => {
      const snap = engine.rename(port, name);
      persistNames(snap);
    },
    setTheme: (theme) => {
      engine.setTheme(theme);
      persistTheme(theme);
    },
    simulateFault: async () => {
      await engine.failsafe("Simulated fault: watchdog / uncaught error");
    },
    tick: () => {
      engine.tick();
    },
  };
});

export function getEngine() {
  return engine;
}
