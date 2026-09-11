import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("Group Stage 8 Private Challenges integration contract", () => {
  it("keeps challenge creation/scoring behind the authenticated Edge service", () => {
    const db = fs.readFileSync(new URL("./groupChallengeDb.js", import.meta.url), "utf8");
    expect(db).toContain('supabase.functions.invoke("group-challenges"');
    expect(db).not.toMatch(/from\("group_challenges"\).*\.(insert|update|upsert|delete)/s);
    expect(db).not.toMatch(/from\("group_challenge_rewards"\)/);
  });

  it("renders Challenges inside the private Group Hub rather than as a public navigation surface", () => {
    const hub = fs.readFileSync(new URL("./GroupHub.jsx", import.meta.url), "utf8");
    expect(hub).toContain('import GroupChallenges from "./GroupChallenges.jsx"');
    expect(hub).toContain("<GroupChallenges");
  });

  it("proves active membership before privileged Group reads and profile ownership before private reward reads", () => {
    const edge = fs.readFileSync(new URL("../../supabase/functions/group-challenges/index.ts", import.meta.url), "utf8");
    expect(edge).toContain("Active Group membership required");
    expect(edge.indexOf("const { data: callerMembership")).toBeLessThan(edge.indexOf("const { data: group"));
    expect(edge).toContain("Profile access required");
    expect(edge.indexOf("const { data: ownedProfile")).toBeLessThan(edge.indexOf('.from("group_challenge_rewards")'));
    expect(edge).not.toMatch(/body\?\.(score|currentValue|progressPct|rewardPoolXp|xpAwarded|finalValue)/);
  });

  it("keeps all Challenge state, baselines and rewards server-only", () => {
    const migration = fs.readFileSync(new URL("../../supabase/migrations/20260911154000_group_team_stage8_private_challenges.sql", import.meta.url), "utf8");
    for (const table of [
      "group_challenges",
      "profile_group_challenge_improvement_baselines",
      "group_challenge_rewards",
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(`revoke all on table public.${table} from public, anon, authenticated`);
    }
    expect(migration).not.toMatch(/grant\s+(insert|update|delete)\s+on\s+table\s+public\.group_/i);
  });

  it("makes the Challenge XP mirror authoritative and prevents metadata-only rewards from changing Consistency schedules", () => {
    const migration = fs.readFileSync(new URL("../../supabase/migrations/20260911154000_group_team_stage8_private_challenges.sql", import.meta.url), "utf8");
    expect(migration).toContain("private.group_challenge_rewards_for_profile");
    expect(migration).toContain("private.apply_group_challenge_rewards_to_plan");
    expect(migration).toContain("profiles_preserve_group_challenge_rewards_trigger");
    expect(migration).toContain("group_challenge_rewards_profile_plan_trigger");
    expect(migration).toContain("v_new_schedule is not distinct from v_old_schedule");
  });

  it("keeps the canonical XP engine byte-identical in Weekly XP and Seasons services", () => {
    const source = fs.readFileSync(new URL("../engine/xpEngine.js", import.meta.url), "utf8");
    const weekly = fs.readFileSync(new URL("../../supabase/functions/group-xp-leaderboard/xpEngine.js", import.meta.url), "utf8");
    const seasons = fs.readFileSync(new URL("../../supabase/functions/group-seasons-awards/xpEngine.js", import.meta.url), "utf8");
    expect(weekly).toBe(source);
    expect(seasons).toBe(source);
  });

  it("keeps challenge-progress XP separate from reward/badge XP to prevent feedback loops", () => {
    const challengeXp = fs.readFileSync(new URL("../engine/groupChallengeXpEngine.js", import.meta.url), "utf8");
    expect(challengeXp).not.toContain("groupChallengeRewards");
    expect(challengeXp).not.toContain("claimedRewards");
    expect(challengeXp).not.toContain("BADGE_XP_BY_KEY");
  });
});
