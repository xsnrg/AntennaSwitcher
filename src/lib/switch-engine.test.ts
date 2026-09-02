import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SwitchEngine,
  FAILSAFE_PORT,
  BREAK_BEFORE_MAKE_MS,
  PORT_IDS,
  type PortId,
} from "./switch-engine.ts";

function makeEngine() {
  const relays = new Map<PortId, boolean>([
    [1, false],
    [2, false],
    [3, false],
    [4, false],
  ]);
  let t = 1_000_000;
  const engine = new SwitchEngine({
    now: () => t,
    delay: async (ms) => {
      t += ms;
    },
    onRelay: (port, on) => {
      relays.set(port, on);
    },
  });
  return {
    engine,
    relays,
    live: () =>
      PORT_IDS.filter((id) => relays.get(id)),
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("SwitchEngine safety", () => {
  it("boots with TX on port 1 (dummy load) and no other relay energized", () => {
    const { engine, live } = makeEngine();
    const snap = engine.snapshot();
    assert.equal(snap.activePort, FAILSAFE_PORT);
    assert.equal(live().join(","), "1");
    assert.equal(snap.ports[0].isDummyLoad, true);
    assert.equal(snap.ports[1].isDummyLoad, false);
    engine.assertExclusive();
  });

  it("selects exactly one port and de-energizes the previous", async () => {
    const { engine, live } = makeEngine();
    await engine.select(3);
    assert.deepEqual(live(), [3]);
    assert.equal(engine.snapshot().activePort, 3);
    engine.assertExclusive();
  });

  it("never energizes two relays, even mid break-before-make", async () => {
    const samples: number[][] = [];
    let t = 0;
    const relays = new Map<PortId, boolean>([
      [1, false],
      [2, false],
      [3, false],
      [4, false],
    ]);
    const engine = new SwitchEngine({
      now: () => t,
      delay: async (ms) => {
        samples.push(PORT_IDS.filter((id) => relays.get(id)));
        t += ms;
      },
      onRelay: (port, on) => relays.set(port, on),
    });
    await engine.select(2);
    samples.push(PORT_IDS.filter((id) => relays.get(id)));
    for (const sample of samples) {
      assert.ok(sample.length <= 1, `overlap detected: ${sample.join(",")}`);
    }
    assert.deepEqual(samples.at(-1), [2]);
    assert.ok(
      samples.some((s) => s.length === 0),
      "break-before-make must open all relays before closing the next",
    );
  });

  it("waits the break-before-make interval", async () => {
    let delayed = 0;
    const engine = new SwitchEngine({
      delay: async (ms) => {
        delayed += ms;
      },
    });
    await engine.select(4);
    assert.equal(delayed, BREAK_BEFORE_MAKE_MS);
  });

  it("rejects invalid ports and fail-safes to port 1", async () => {
    const { engine, live } = makeEngine();
    await engine.select(2);
    const snap = await engine.select(9);
    assert.equal(snap.activePort, FAILSAFE_PORT);
    assert.deepEqual(live(), [1]);
    assert.ok(snap.lastError);
    assert.equal(snap.errorCount, 1);
  });

  it("trapAndExit parks TX on the dummy load before returning", async () => {
    const { engine, live } = makeEngine();
    await engine.select(4);
    const snap = engine.trapAndExit("uncaught exception");
    assert.equal(snap.activePort, 1);
    assert.deepEqual(live(), [1]);
    assert.equal(snap.switching, false);
    assert.match(snap.lastError ?? "", /uncaught exception/);
  });

  it("failsafe recovers even if a later select is in flight", async () => {
    const { engine, live } = makeEngine();
    await engine.select(2);
    const snap = await engine.failsafe("watchdog");
    assert.equal(snap.activePort, 1);
    assert.deepEqual(live(), [1]);
    assert.equal(snap.ports[0].isDummyLoad, true);
  });

  it("rename persists and refuses empty names", () => {
    const { engine } = makeEngine();
    engine.rename(2, "  40m dipole  ");
    assert.equal(engine.snapshot().ports[1].name, "40m dipole");
    engine.rename(2, "   ");
    assert.equal(engine.snapshot().ports[1].name, "40m dipole");
    engine.rename(9, "nope");
    assert.equal(engine.snapshot().activePort, 1);
  });

  it("selecting the already-active port is a no-op", async () => {
    const { engine } = makeEngine();
    const before = engine.snapshot().operationCount;
    await engine.select(1);
    assert.equal(engine.snapshot().operationCount, before);
  });

  it("accumulates on-time only for the live port", async () => {
    const { engine, advance } = makeEngine();
    await engine.select(2);
    advance(5_000);
    engine.tick();
    const snap = engine.snapshot();
    assert.ok(snap.ports[1].totalSelectedMs >= 5_000);
    assert.equal(snap.ports[2].totalSelectedMs, 0);
  });

  it("increments per-port select counts", async () => {
    const { engine } = makeEngine();
    await engine.select(2);
    await engine.select(3);
    await engine.select(2);
    const snap = engine.snapshot();
    assert.equal(snap.ports[1].selectCount, 2);
    assert.equal(snap.ports[2].selectCount, 1);
  });

  it("serializes overlapping select calls so two relays never close together", async () => {
    const liveLog: string[] = [];
    const relays = new Map<PortId, boolean>([
      [1, false],
      [2, false],
      [3, false],
      [4, false],
    ]);
    let t = 0;
    const engine = new SwitchEngine({
      now: () => t,
      delay: (ms) =>
        new Promise((resolve) => {
          liveLog.push(PORT_IDS.filter((id) => relays.get(id)).join(",") || "open");
          t += ms;
          setTimeout(resolve, 5);
        }),
      onRelay: (port, on) => relays.set(port, on),
    });
    await Promise.all([engine.select(2), engine.select(3), engine.select(4)]);
    assert.ok(liveLog.every((row) => !row.includes(",")));
    assert.equal(engine.snapshot().activePort, 4);
    assert.deepEqual(
      PORT_IDS.filter((id) => relays.get(id)),
      [4],
    );
  });

  it("theme changes do not touch relays", () => {
    const { engine, live } = makeEngine();
    engine.setTheme("grey");
    assert.deepEqual(live(), [1]);
    assert.equal(engine.snapshot().theme, "grey");
  });

  it("exposes lab board metrics for 3.3 V rail, die temp, and RSSI", () => {
    const { engine } = makeEngine();
    const snap = engine.snapshot();
    assert.equal(snap.board.railOk, true);
    assert.equal(snap.board.resetReason, "power-on");
    assert.ok(snap.board.tempC != null && snap.board.tempC > 20);
    assert.ok(snap.board.rssiDbm != null && snap.board.rssiDbm < 0);
    assert.ok((snap.board.heapBytes ?? 0) > 0);
  });
});
