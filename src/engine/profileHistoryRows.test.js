import { describe, expect, it } from "vitest";
import { mapProfileHistoryRows, mergeProfileHistoryWithCache } from "./profileHistoryRows.js";
import { scopeProgressLogs } from "./progressTrainingEngine.js";

describe("profile history identity after saving", () => {
  it("keeps saved and optimistic rows visible in the same athlete's Progress without switching away", () => {
    const payload = { blocks: [{ id: "session-1", typeId: "session", session: { completed: true } }] };
    const loaded = mapProfileHistoryRows([{ profile_id: "wilf", date_ymd: "2026-10-03", log_json: payload }], "wilf");
    const savedRefresh = mapProfileHistoryRows([{ date_ymd: "2026-10-03", log: payload }], "wilf");
    expect(scopeProgressLogs(loaded, "wilf")).toHaveLength(1);
    expect(scopeProgressLogs(savedRefresh, "wilf")).toHaveLength(1);
    expect(scopeProgressLogs(savedRefresh, "xander")).toHaveLength(0);
  });
  it("rejects another athlete's rows rather than relabelling them", () => {
    expect(mapProfileHistoryRows([{ profile_id: "xander", log_json: { blocks: [] } }], "wilf")).toEqual([]);
  });
});

describe("history refresh from another device", () => {
  const first = "family:athlete:2026-10-15", second = "family:athlete:2026-10-16";
  const oldLog = { blocks: [{ id: "run", cardio: { distanceKm: "1" } }] };
  const newLog = { blocks: [{ id: "run", cardio: { distanceKm: "5" } }] };
  const rows = [
    { id: "row-1", profile_id: "athlete", date_ymd: "2026-10-15", log_json: newLog },
    { id: "row-2", profile_id: "athlete", date_ymd: "2026-10-16", log_json: newLog },
  ];
  it("replaces stale cached days, including previously saved local days, with server history", () => {
    const revisions = new Map([[first, 2]]);
    const result = mergeProfileHistoryWithCache(rows, { familyId: "family", profileId: "athlete",
      cache: { [first]: oldLog, [second]: oldLog }, revisions, persisted: revisions,
      revisionsAtStart: revisions, persistedAtStart: revisions });
    expect(result.map((r) => r.log)).toEqual([newLog, newLog]);
    expect(result.map((r) => r.id)).toEqual(["row-1", "row-2"]);
  });
  it("preserves unsaved edits and edits saved while the history request was in flight", () => {
    const result = mergeProfileHistoryWithCache(rows, { familyId: "family", profileId: "athlete",
      cache: { [first]: oldLog, [second]: oldLog },
      revisions: new Map([[first, 3], [second, 2]]), persisted: new Map([[first, 2], [second, 2]]),
      revisionsAtStart: new Map([[first, 2], [second, 1]]), persistedAtStart: new Map([[first, 2], [second, 1]]) });
    expect(result.map((r) => r.log)).toEqual([oldLog, oldLog]);
  });
  it("retains known saved days omitted by a bounded read without mixing another profile's cache", () => {
    expect(mergeProfileHistoryWithCache([], { familyId: "family", profileId: "athlete",
      cache: { [first]: oldLog, "family:other:2026-10-16": newLog },
      revisions: new Map([["family:other:2026-10-16", 1]]) })).toEqual([{ profile_id: "athlete", date_ymd: "2026-10-15", log: oldLog }]);
  });
});
