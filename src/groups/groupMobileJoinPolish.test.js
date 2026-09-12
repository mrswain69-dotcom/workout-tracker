import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { loadUntilGroupVisible } from "./groupReadAfterWrite.js";

describe("Group mobile/join polish", () => {
  it("retries a transient stale Group read until the newly joined Group is visible", async () => {
    const loadGroups = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: "old-group" }], error: null })
      .mockResolvedValueOnce({ data: [{ id: "old-group" }], error: null })
      .mockResolvedValueOnce({ data: [{ id: "old-group" }, { id: "joined-group" }], error: null });

    const result = await loadUntilGroupVisible(loadGroups, "joined-group", [0, 0, 0, 0]);

    expect(loadGroups).toHaveBeenCalledTimes(3);
    expect(result.data.map((group) => group.id)).toContain("joined-group");
  });

  it("does not retry ordinary Group reads that have no pending joined Group", async () => {
    const loadGroups = vi.fn().mockResolvedValue({ data: [{ id: "group-1" }], error: null });

    const result = await loadUntilGroupVisible(loadGroups, "", [0, 0, 0]);

    expect(loadGroups).toHaveBeenCalledTimes(1);
    expect(result.data).toHaveLength(1);
  });

  it("records the joined Group and routes the next profile refresh through read-after-write visibility", () => {
    const db = fs.readFileSync(new URL("./groupDb.js", import.meta.url), "utf8");
    expect(db).toContain("pendingJoinedGroupByProfile.set(profileId, joined.group_id)");
    expect(db).toContain("loadUntilGroupVisible(");
    expect(db).toContain("pendingJoinedGroupByProfile.delete(profileId)");
  });

  it("fits the three-column Group standings inside the mobile card without sideways scrolling", () => {
    const css = fs.readFileSync(new URL("./GroupMobilePolish.css", import.meta.url), "utf8").replace(/\s+/g, "");
    const main = fs.readFileSync(new URL("../main.jsx", import.meta.url), "utf8");

    expect(main).toContain("./groups/GroupMobilePolish.css");
    expect(css).toContain(".groupXpStandings{width:100%;max-width:100%;overflow:hidden");
    expect(css).toContain("grid-template-columns:42pxminmax(0,1fr)minmax(72px,96px)!important");
    expect(css).toContain("min-width:0!important");
    expect(css).not.toContain("overflow-x:auto");
    expect(css).not.toContain("min-width:320px");
    expect(css).not.toContain("min-width:330px");
  });

  it("keeps the Discipline consistency metric inside the shared third grid column", () => {
    const css = fs.readFileSync(new URL("./GroupConsistency.css", import.meta.url), "utf8").replace(/\s+/g, "");

    expect(css).toContain(".groupConsistencyScoreCell{display:flex;width:100%;min-width:0;max-width:100%;box-sizing:border-box;overflow:hidden");
    expect(css).toContain(".groupConsistencyScoreCellsmall{max-width:100%;overflow-wrap:anywhere");
    expect(css).toContain(".groupConsistencyPanel.groupXpStandingHeader>span:last-child{min-width:0;text-align:right");
    expect(css).not.toContain("min-width:112px");
    expect(css).not.toContain("min-width:92px");
  });
});
