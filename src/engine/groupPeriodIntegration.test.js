import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Stage 6 Group seasons integration contract", () => {
  it("keeps the Stage 6 server copies identical to the authoritative scoring engines", () => {
    expect(read("supabase/functions/group-seasons-awards/xpEngine.js")).toBe(
      read("supabase/functions/group-xp-leaderboard/xpEngine.js")
    );
    expect(read("supabase/functions/group-seasons-awards/xpRewardMap.generated.js")).toBe(
      read("supabase/functions/group-xp-leaderboard/xpRewardMap.generated.js")
    );
    expect(read("supabase/functions/group-seasons-awards/consistencyEngine.js")).toBe(
      read("supabase/functions/group-consistency-leaderboard/consistencyEngine.js")
    );
    expect(read("supabase/functions/group-seasons-awards/improvementEngine.js")).toBe(
      read("supabase/functions/group-improvement-leaderboard/improvementEngine.js")
    );
    expect(read("supabase/functions/group-seasons-awards/groupPeriodEngine.js")).toBe(
      read("src/engine/groupPeriodEngine.js")
    );
  });

  it("requires caller membership proof before privileged Group scoring reads", () => {
    const source = read("supabase/functions/group-seasons-awards/index.ts");
    const membershipProof = source.indexOf('userClient\n      .from("group_memberships")');
    const firstAdminGroupRead = source.indexOf('adminClient\n      .from("groups")');
    expect(membershipProof).toBeGreaterThan(-1);
    expect(source).toContain('.eq("id", membershipId)');
    expect(source).toContain('.eq("group_id", groupId)');
    expect(source).toContain('.eq("status", "active")');
    expect(firstAdminGroupRead).toBeGreaterThan(membershipProof);
  });

  it("never accepts browser-authored XP, Consistency or Improvement scores", () => {
    const source = read("supabase/functions/group-seasons-awards/index.ts");
    expect(source).toContain('const groupId = typeof body?.groupId === "string" ? body.groupId : "";');
    expect(source).toContain('const membershipId = typeof body?.membershipId === "string" ? body.membershipId : "";');
    expect(source).not.toMatch(/body\?\.(xp|consistencyPct|improvementPct|plannedDays|completedDays)/);
  });

  it("keeps frozen results and awards behind Group-member RLS while private baselines have no browser grant", () => {
    const migration = read("supabase/migrations/20260911124500_group_team_stage6_seasons_awards.sql");
    expect(migration).toContain("alter table public.profile_period_improvement_baselines enable row level security");
    expect(migration).toContain("revoke all on table public.profile_period_improvement_baselines from public, anon, authenticated");
    expect(migration).toContain("alter table public.group_period_results enable row level security");
    expect(migration).toContain("grant select on table public.group_period_results to authenticated");
    expect(migration).toContain("using (group_id in (select private.current_user_group_ids()))");
    expect(migration).toContain("alter table public.group_progress_awards enable row level security");
    expect(migration).toContain("grant select on table public.group_progress_awards to authenticated");
  });

  it("freezes only completed periods and creates awards only from frozen standings", () => {
    const source = read("supabase/functions/group-seasons-awards/index.ts");
    expect(source).toContain('state: "live"');
    expect(source).toContain('state: "frozen"');
    expect(source).toContain("buildGroupProgressAwards({");
    expect(source).toContain('state: "frozen",');
    expect(source).toContain('ignoreDuplicates: true');
  });
});
