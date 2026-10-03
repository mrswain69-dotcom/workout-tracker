import { describe, expect, it, vi } from "vitest";
import { createKeyedLogWriteQueue, sameLogView, selectDayLogSnapshot } from "./dayLogLifecycle.js";

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

describe("dated log lifecycle", () => {
  it("retains entries and new extra blocks after navigation even when a persisted read is older", () => {
    const original = { blocks: [{ id: "strength", sets: {} }] };
    const local = { blocks: [{ id: "strength", sets: { press: [{ reps: "12", weight: "22.5" }] } }, { id: "extra", label: "Dips", isExtra: true }] };
    expect(selectDayLogSnapshot({ cached: local, remote: original, localRevision: 2 })).toBe(local);
    expect(selectDayLogSnapshot({ cached: local, remote: null, localRevision: 2 })).toBe(local);
    expect(selectDayLogSnapshot({ remote: original })).toBe(original);
  });

  it("rejects a save or read for a date/profile that is no longer visible", () => {
    const current = { familyId: "family", profileId: "paul", date: "2026-10-02" };
    expect(sameLogView(current, "family", "paul", "2026-10-01")).toBe(false);
    expect(sameLogView(current, "family", "wilf", "2026-10-02")).toBe(false);
    expect(sameLogView(current, "family", "paul", "2026-10-02")).toBe(true);
  });

  it("serializes writes on one day while allowing another day to save independently", async () => {
    const queue = createKeyedLogWriteQueue();
    const slowFirst = deferred();
    const events = [];
    const first = queue("paul:2026-10-01", async () => { events.push("first-start"); await slowFirst.promise; events.push("first-end"); });
    const second = queue("paul:2026-10-01", async () => { events.push("second"); });
    const other = queue("paul:2026-10-02", async () => { events.push("other-day"); });
    await other;
    expect(events).toEqual(["first-start", "other-day"]);
    slowFirst.resolve();
    await Promise.all([first, second]);
    expect(events).toEqual(["first-start", "other-day", "first-end", "second"]);
  });

  it("allows the next save to proceed after a failed write", async () => {
    const queue = createKeyedLogWriteQueue();
    const write = vi.fn(async () => "saved");
    await expect(queue("day", async () => { throw new Error("network"); })).rejects.toThrow("network");
    await expect(queue("day", write)).resolves.toBe("saved");
    expect(write).toHaveBeenCalledTimes(1);
  });
});
