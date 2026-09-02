export const PORT_IDS = [1, 2, 3, 4] as const;
export type PortId = (typeof PORT_IDS)[number];

export const FAILSAFE_PORT: PortId = 1;
export const BREAK_BEFORE_MAKE_MS = 80;
export const DEFAULT_GPIO = [32, 33, 25, 26] as const;
export const DEFAULT_NAMES = [
  "Dummy Load",
  "Antenna 2",
  "Antenna 3",
  "Antenna 4",
] as const;

export type ThemeId = "system" | "light" | "dark" | "grey";
export const THEME_IDS: ThemeId[] = ["system", "light", "dark", "grey"];

export class SwitchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SwitchError";
  }
}

export interface PortRecord {
  id: PortId;
  name: string;
  gpio: number;
  relay: number;
  isDummyLoad: boolean;
  selectCount: number;
  totalSelectedMs: number;
  lastSelectedAt: number | null;
}

export interface SwitchEvent {
  id: number;
  at: number;
  kind: "select" | "failsafe" | "boot" | "rename" | "error";
  message: string;
  port: PortId | null;
}

export interface SwitchSnapshot {
  activePort: PortId | null;
  pendingPort: PortId | null;
  switching: boolean;
  lastError: string | null;
  errorCount: number;
  operationCount: number;
  startedAt: number;
  now: number;
  theme: ThemeId;
  ports: PortRecord[];
  events: SwitchEvent[];
  board: BoardMetrics;
}

export interface BoardMetrics {
  railOk: boolean;
  resetReason: string;
  tempC: number | null;
  rssiDbm: number | null;
  heapBytes: number | null;
  ip: string | null;
}

export interface EngineOptions {
  now?: () => number;
  delay?: (ms: number) => Promise<void>;
  onRelay?: (port: PortId, energized: boolean) => void;
}

function isPortId(value: number): value is PortId {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function defaultDelay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export class SwitchEngine {
  private activePort: PortId | null = null;
  private pendingPort: PortId | null = null;
  private switching = false;
  private lastError: string | null = null;
  private errorCount = 0;
  private operationCount = 0;
  private startedAt: number;
  private lastTick: number;
  private theme: ThemeId = "system";
  private ports: PortRecord[];
  private events: SwitchEvent[] = [];
  private eventSeq = 0;
  private selectLock: Promise<void> = Promise.resolve();
  private readonly now: () => number;
  private readonly delay: (ms: number) => Promise<void>;
  private readonly onRelay: (port: PortId, energized: boolean) => void;
  private listeners = new Set<() => void>();
  private board: BoardMetrics;

  constructor(options: EngineOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.delay = options.delay ?? defaultDelay;
    this.onRelay = options.onRelay ?? (() => {});
    this.startedAt = this.now();
    this.lastTick = this.startedAt;
    this.ports = PORT_IDS.map((id) => ({
      id,
      name: DEFAULT_NAMES[id - 1],
      gpio: DEFAULT_GPIO[id - 1],
      relay: id,
      isDummyLoad: id === FAILSAFE_PORT,
      selectCount: 0,
      totalSelectedMs: 0,
      lastSelectedAt: null,
    }));
    this.bootFailsafe();
    this.board = this.sampleLabBoard(this.startedAt);
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot(): SwitchSnapshot {
    this.accumulateTime(this.now());
    return {
      activePort: this.activePort,
      pendingPort: this.pendingPort,
      switching: this.switching,
      lastError: this.lastError,
      errorCount: this.errorCount,
      operationCount: this.operationCount,
      startedAt: this.startedAt,
      now: this.now(),
      theme: this.theme,
      ports: this.ports.map((p) => ({ ...p })),
      events: [...this.events],
      board: { ...this.board },
    };
  }

  energizedRelays(): PortId[] {
    return this.activePort === null ? [] : [this.activePort];
  }

  assertExclusive(): void {
    const live = this.energizedRelays();
    if (live.length > 1) {
      throw new SwitchError(
        `TX connected to ${live.length} ports at once: ${live.join(",")}`,
      );
    }
    if (!this.switching && live.length !== 1) {
      throw new SwitchError("At rest the TX port must connect to exactly one antenna port");
    }
  }

  async select(port: number): Promise<SwitchSnapshot> {
    const run = this.selectLock.then(() => this.selectExclusive(port));
    this.selectLock = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async failsafe(reason: string): Promise<SwitchSnapshot> {
    this.errorCount += 1;
    this.lastError = reason;
    this.pushEvent("failsafe", reason, FAILSAFE_PORT);
    try {
      await this.forcePort(FAILSAFE_PORT);
    } catch (err) {
      this.lastError = `${reason}; recovery failed: ${String(err)}`;
      this.deenergizeAll();
      this.energize(FAILSAFE_PORT);
      this.activePort = FAILSAFE_PORT;
      this.switching = false;
      this.pendingPort = null;
    }
    this.notify();
    return this.snapshot();
  }

  trapAndExit(reason: string): SwitchSnapshot {
    this.errorCount += 1;
    this.lastError = reason;
    this.deenergizeAll();
    this.energize(FAILSAFE_PORT);
    this.activePort = FAILSAFE_PORT;
    this.pendingPort = null;
    this.switching = false;
    this.pushEvent("failsafe", `exit trap: ${reason}`, FAILSAFE_PORT);
    this.notify();
    return this.snapshot();
  }

  rename(port: number, name: string): SwitchSnapshot {
    if (!isPortId(port)) {
      return this.trapAndExit(`rename: invalid port ${port}`);
    }
    const trimmed = name.trim().slice(0, 32);
    if (!trimmed) {
      this.lastError = "Port name cannot be empty";
      this.notify();
      return this.snapshot();
    }
    const record = this.ports[port - 1];
    record.name = trimmed;
    if (port === FAILSAFE_PORT) {
      record.isDummyLoad = true;
    }
    this.pushEvent("rename", `Port ${port} named “${trimmed}”`, port);
    this.notify();
    return this.snapshot();
  }

  setTheme(theme: ThemeId): SwitchSnapshot {
    this.theme = theme;
    this.notify();
    return this.snapshot();
  }

  tick(): SwitchSnapshot {
    this.accumulateTime(this.now());
    this.board = this.sampleLabBoard(this.now());
    this.notify();
    return this.snapshot();
  }

  private bootFailsafe() {
    this.deenergizeAll();
    this.energize(FAILSAFE_PORT);
    this.activePort = FAILSAFE_PORT;
    const port = this.ports[FAILSAFE_PORT - 1];
    port.selectCount = 1;
    port.lastSelectedAt = this.startedAt;
    this.pushEvent(
      "boot",
      "Boot: TX parked on port 1 (50 Ω dummy load)",
      FAILSAFE_PORT,
    );
  }

  private async selectExclusive(port: number): Promise<SwitchSnapshot> {
    try {
      if (!isPortId(port)) {
        throw new SwitchError(`Invalid port ${port}`);
      }
      if (this.activePort === port && !this.switching) {
        return this.snapshot();
      }
      await this.forcePort(port);
      this.lastError = null;
      this.notify();
      return this.snapshot();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.failsafe(message);
    }
  }

  private async forcePort(port: PortId): Promise<void> {
    this.switching = true;
    this.pendingPort = port;
    this.notify();

    this.deenergizeAll();
    this.activePort = null;
    this.assertExclusive();

    await this.delay(BREAK_BEFORE_MAKE_MS);

    this.energize(port);
    this.activePort = port;
    this.switching = false;
    this.pendingPort = null;
    this.operationCount += 1;

    const record = this.ports[port - 1];
    record.selectCount += 1;
    record.lastSelectedAt = this.now();
    this.pushEvent("select", `TX → ${record.name} (port ${port})`, port);
    this.assertExclusive();
  }

  private deenergizeAll() {
    this.accumulateTime(this.now());
    for (const id of PORT_IDS) {
      this.onRelay(id, false);
    }
    this.activePort = null;
  }

  private energize(port: PortId) {
    for (const id of PORT_IDS) {
      this.onRelay(id, id === port);
    }
  }

  private accumulateTime(now: number) {
    const delta = Math.max(0, now - this.lastTick);
    if (this.activePort && delta > 0) {
      this.ports[this.activePort - 1].totalSelectedMs += delta;
    }
    this.lastTick = now;
  }

  private pushEvent(
    kind: SwitchEvent["kind"],
    message: string,
    port: PortId | null,
  ) {
    this.eventSeq += 1;
    this.events.unshift({
      id: this.eventSeq,
      at: this.now(),
      kind,
      message,
      port,
    });
    if (this.events.length > 40) this.events.length = 40;
  }

  private sampleLabBoard(now: number): BoardMetrics {
    const t = (now - this.startedAt) / 1000;
    return {
      railOk: true,
      resetReason: "power-on",
      tempC: round1(40.4 + Math.sin(t / 14) * 1.5),
      rssiDbm: Math.round(-55 + Math.sin(t / 20) * 3),
      heapBytes: 186432,
      ip: "lab",
    };
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatClock(ts: number | null, now: number): string {
  if (!ts) return "—";
  const delta = Math.max(0, now - ts);
  if (delta < 5_000) return "just now";
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTempC(c: number | null): string {
  if (c == null || !Number.isFinite(c)) return "—";
  return `${Math.round(c)} °C`;
}

export function formatTempF(c: number | null): string {
  if (c == null || !Number.isFinite(c)) return "—";
  return `${Math.round((c * 9) / 5 + 32)} °F`;
}

export function formatRssi(dbm: number | null): string {
  if (dbm == null || !Number.isFinite(dbm)) return "—";
  return `${Math.round(dbm)} dBm`;
}

export function formatHeap(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  return `${Math.round(bytes / 1024)} kB`;
}
