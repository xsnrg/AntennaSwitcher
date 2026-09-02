import { cn } from "@/lib/cn";
import { useSwitchStore } from "@/lib/store";
import {
  formatHeap,
  formatRssi,
  formatTempC,
  formatTempF,
} from "@/lib/switch-engine";

export function BoardMetrics() {
  const board = useSwitchStore((s) => s.snap.board);
  const lab = board.ip === "lab";
  const browned = !board.railOk;

  return (
    <section
      data-testid="board-metrics"
      className="rounded-xl bg-surface px-4 py-4 shadow-border sm:px-5"
      aria-label="Board sensors"
    >
      <p className="mb-3 font-mono text-xs tracking-[0.18em] text-muted uppercase">
        Board · {lab ? "lab console" : (board.ip ?? "ESP32")}
      </p>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric
          label="3.3 V rail"
          value={browned ? "Brownout" : "OK"}
          hint={`last reset: ${board.resetReason}`}
          testId="metric-rail"
          warn={browned}
          emphasis
        />
        <Metric
          label="Die temp"
          value={formatTempC(board.tempC)}
          hint={formatTempF(board.tempC)}
          testId="metric-temp"
          warn={
            board.tempC != null &&
            Number.isFinite(board.tempC) &&
            board.tempC >= 70
          }
        />
        <Metric
          label="WiFi"
          value={formatRssi(board.rssiDbm)}
          hint={rssiHint(board.rssiDbm)}
          testId="metric-rssi"
          warn={
            board.rssiDbm != null &&
            Number.isFinite(board.rssiDbm) &&
            board.rssiDbm < -80
          }
        />
        <Metric
          label="Free heap"
          value={formatHeap(board.heapBytes)}
          hint="SRAM"
          testId="metric-heap"
        />
      </dl>
      <p className="mt-3 text-xs text-subtle">
        5 V coil rail is not brought to an ADC on this board. 3.3 V is watched
        by the brownout detector, not a voltmeter.
      </p>
    </section>
  );
}

function rssiHint(dbm: number | null): string {
  if (dbm == null || !Number.isFinite(dbm)) return "—";
  if (dbm >= -55) return "strong";
  if (dbm >= -70) return "good";
  if (dbm >= -80) return "fair";
  return "weak";
}

function Metric({
  label,
  value,
  hint,
  testId,
  warn,
  emphasis,
}: {
  label: string;
  value: string;
  hint: string;
  testId: string;
  warn?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd
        data-testid={testId}
        className={cn(
          "mt-1 font-mono tabular-nums tracking-tight",
          emphasis ? "text-2xl" : "text-lg",
          warn ? "text-danger" : "text-fg",
        )}
      >
        {value}
      </dd>
      <p className={cn("mt-0.5 text-xs", warn ? "text-danger" : "text-subtle")}>
        {hint}
      </p>
    </div>
  );
}
