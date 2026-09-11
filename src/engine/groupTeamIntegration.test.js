import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Stage 7 Squad and Club integration contract", () => {
  it("keeps server scoring copies aligned with the authoritative team and season engines", () => {
    expect(read("supabase/functions/group-team-pr-board/groupTeamEngine.js")).toBe(
      read("src/engine/groupTeamEngine.js")
    );
    expect(read("supabase/functions/group-team-pr-board/groupPeriodEngine.js")).toBe(
      read("src/engine/groupPeriodEngine.js")
    );
  });

  it("proves active caller membership before privileged cross-family log reads", () => {
    const source = read("supabase/functions/group-team-pr-board/index.ts");
    const membershipProof = source.indexOf('userClient\n      .from("group_memberships")');
    const firstAdminRead = source.indexOf('adminClient\n      .from("groups")');
    const logRead = source.indexOf('.from("logs")');
    expect(membershipProof).toBeGreaterThan(-1);
    expect(source).toContain('.eq("id", membershipId)');
    expect(source).toContain('.eq("group_id", groupId)');
    expect(source).toContain('.eq("status", "active")');
    expect(firstAdminRead).toBeGreaterThan(membershipProof);
    expect(logRead).toBeGreaterThan(membershipProof);
  });

  it("accepts no browser-authored PR score or private athlete performance fields", () => {
    const source = read("supabase/functions/group-team-pr-board/index.ts");
    expect(source).toContain('const groupId = typeof body?.groupId === "string" ? body.groupId : "";');
    expect(source).toContain('const membershipId = typeof body?.membershipId === "string" ? body.membershipId : "";');
    expect(source).not.toMatch(/body\?\.(prCount|score|xp|consistencyPct|improvementPct|profileId|weight|log|assessment)/);
  });

  it("is read-only, team-only and paginates lifetime logs for truthful PR history", () => {
    const source = read("supabase/functions/group-team-pr-board/index.ts");
    expect(source).toContain('new Set(["squad", "club"])');
    expect(source).toContain('.range(from, from + pageSize - 1)');
    expect(source).not.toContain(".insert(");
    expect(source).not.toContain(".upsert(");
    expect(source).not.toContain(".update(");
    expect(source).not.toContain(".delete(");
    expect(source).not.toContain('from("assessment_runs")');
    expect(source).not.toContain('from("assessment_test_results")');
  });

  it("returns only safe competition identity plus aggregate PR evidence", () => {
    const source = read("supabase/functions/group-team-pr-board/index.ts");
    const safeRowStart = source.indexOf("return {\n        membership_id: member.id,");
    const safeRowEnd = source.indexOf("      };", safeRowStart);
    expect(safeRowStart).toBeGreaterThan(-1);
    const safeRow = source.slice(safeRowStart, safeRowEnd);
    expect(safeRow).toContain("membership_id: member.id");
    expect(safeRow).toContain("nickname: member.nickname");
    expect(safeRow).toContain("prCount: summary.prCount");
    expect(safeRow).toContain("latestPrDate: summary.latestPrDate");
    expect(safeRow).not.toContain("profile_id");
    expect(safeRow).not.toContain("log_json");
    expect(safeRow).not.toContain("weight");
    expect(safeRow).not.toContain("assessment");
  });
});
