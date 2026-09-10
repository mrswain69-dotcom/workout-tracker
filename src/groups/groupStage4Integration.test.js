import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("Group Stage 4 Consistency integration contract", () => {
  it("keeps the browser on the authenticated Consistency server function", () => {
    const db = fs.readFileSync(new URL("./groupDb.js", import.meta.url), "utf8");
    expect(db).toContain('supabase.functions.invoke("group-consistency-leaderboard"');
    expect(db).not.toMatch(/from\("group_weekly_consistency_results"\).*\.(insert|update|upsert|delete)/s);
  });

  it("renders Consistency after Weekly XP and before member management", () => {
    const hub = fs.readFileSync(new URL("./GroupHub.jsx", import.meta.url), "utf8");
    const xpIndex = hub.indexOf("<GroupWeeklyXp");
    const consistencyIndex = hub.indexOf("<GroupConsistency");
    const membersIndex = hub.indexOf("<h4>Members</h4>");
    expect(xpIndex).toBeGreaterThan(-1);
    expect(consistencyIndex).toBeGreaterThan(xpIndex);
    expect(consistencyIndex).toBeLessThan(membersIndex);
  });

  it("deploys the exact pure Consistency engine with the Edge scorer", () => {
    const sourceEngine = fs.readFileSync(new URL("../engine/consistencyEngine.js", import.meta.url), "utf8");
    const edgeEngine = fs.readFileSync(new URL("../../supabase/functions/group-consistency-leaderboard/consistencyEngine.js", import.meta.url), "utf8");
    expect(edgeEngine).toBe(sourceEngine);
  });

  it("requires active membership proof before privileged scoring and does not trust browser scores", () => {
    const edge = fs.readFileSync(new URL("../../supabase/functions/group-consistency-leaderboard/index.ts", import.meta.url), "utf8");
    expect(edge).toContain("Active Group membership required");
    expect(edge.indexOf('userClient\n      .from("group_memberships")')).toBeLessThan(edge.indexOf('adminClient\n      .from("groups")'));
    expect(edge).not.toMatch(/body\?\.(score|consistencyPct|consistency_pct|plannedDays|completedDays)/);
    expect(edge).not.toContain("family_id:");
    expect(edge).not.toContain("profile_id:");
  });

  it("locks schedule truth privately and exposes frozen result rows read-only", () => {
    const migration = fs.readFileSync(new URL("../../supabase/migrations/20260910171000_group_team_stage4_consistency.sql", import.meta.url), "utf8");
    expect(migration).toContain("profile_consistency_schedule_snapshots");
    expect(migration).toContain("profiles_consistency_schedule_snapshot_trigger");
    expect(migration).toContain("group_weekly_consistency_results");
    expect(migration).toContain("alter table public.group_weekly_consistency_results enable row level security");
    expect(migration).toContain("grant select on table public.group_weekly_consistency_results to authenticated");
    expect(migration).toContain("revoke all on table public.profile_consistency_schedule_snapshots from public, anon, authenticated");
    expect(migration).toContain("v_effective_date := ((now() at time zone 'Europe/London')::date + 1)");
  });
});
