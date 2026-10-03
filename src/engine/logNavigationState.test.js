import { describe, expect, it } from "vitest";
import { clearLogNavigation, readLogNavigation, writeLogNavigation } from "./logNavigationState.js";

function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

describe("refresh navigation", () => {
  it("returns to the same tab and historical date after refresh", () => {
    const store = storage();
    writeLogNavigation(store, "log", "2026-10-01");
    expect(readLogNavigation(store, "2026-10-03")).toEqual({ tab: "log", date: "2026-10-01" });
    writeLogNavigation(store, "stats", "2026-10-01");
    expect(readLogNavigation(store, "2026-10-03")).toEqual({ tab: "stats", date: "2026-10-01" });
  });
  it("rejects invalid routes and calendar dates and clears navigation on sign-out", () => {
    const store = storage();
    writeLogNavigation(store, "unknown", "2026-02-30");
    expect(readLogNavigation(store, "2026-10-03")).toEqual({ tab: "dashboard", date: "2026-10-03" });
    writeLogNavigation(store, "log", "2026-10-01");
    clearLogNavigation(store);
    expect(readLogNavigation(store, "2026-10-03")).toEqual({ tab: "dashboard", date: "2026-10-03" });
  });
  it("works when browser storage is blocked", () => {
    const unavailable = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
    expect(readLogNavigation(unavailable, "2026-10-03")).toEqual({ tab: "dashboard", date: "2026-10-03" });
    expect(() => writeLogNavigation(unavailable, "log", "2026-10-01")).not.toThrow();
  });
});
