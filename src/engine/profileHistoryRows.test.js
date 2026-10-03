import { describe, expect, it } from "vitest";
import { mapProfileHistoryRows } from "./profileHistoryRows.js";
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
