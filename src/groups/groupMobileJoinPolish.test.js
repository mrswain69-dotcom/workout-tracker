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

  it("keeps wide Group standings inside the mobile viewport with horizontal scrolling", () => {
    const css = fs.readFileSync(new URL("./GroupMobilePolish.css", import.meta.url), "utf8").replace(/\s+/g, "");
    const main = fs.readFileSync(new URL("../main.jsx", import.meta.url), "utf8");

    expect(main).toContain("./groups/GroupMobilePolish.css");
    expect(css).toContain(".groupXpStandings{width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden");
    expect(css).toContain(".groupSeasonStandings.groupXpStandingHeader");
    expect(css).toContain(".groupTeamPrTable.groupXpStandingHeader");
  });
});
