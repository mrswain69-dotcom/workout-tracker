import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("Group Stage 5 Improvement integration contract", () => {
  it("keeps the browser on the authenticated Improvement server function", () => {
    const db = fs.readFileSync(new URL("./groupDb.js", import.meta.url), "utf8");
    expect(db).toContain('supabase.functions.invoke("group-improvement-leaderboard"');
    expect(db).not.toMatch(/from\("group_weekly_improvement_results"\).*\.(insert|update|upsert|delete)/s);
    expect(db).not.toMatch(/from\("profile_weekly_improvement_baselines"\)/);
  });

  it("renders Improvement immediately after the existing Consistency surface", () => {
    const consistency = fs.readFileSync(new URL("./GroupConsistency.jsx", import.meta.url), "utf8");
    const consistencyPanel = consistency.indexOf('className="groupHubPanel groupXpPanel groupConsistencyPanel"');
    const improvementPanel = consistency.indexOf("<GroupImprovement");
    expect(consistencyPanel).toBeGreaterThan(-1);
    expect(improvementPanel).toBeGreaterThan(consistencyPanel);
  });

  it("deploys the exact pure Improvement engine with the Edge scorer", () => {
    const sourceEngine = fs.readFileSync(new URL("../engine/groupImprovementEngine.js", import.meta.url), "utf8");
    const edgeEngine = fs.readFileSync(new URL("../../supabase/functions/group-improvement-leaderboard/improvementEngine.js", import.meta.url), "utf8");
    expect(edgeEngine).toBe(sourceEngine);
  });

  it("requires active membership proof before privileged performance reads and rejects browser-authored scores", () => {
    const edge = fs.readFileSync(new URL("../../supabase/functions/group-improvement-leaderboard/index.ts", import.meta.url), "utf8");
    expect(edge).toContain("Active Group membership required");
    expect(edge.indexOf("const { data: callerMembership")).toBeLessThan(edge.indexOf("const { data: group"));
    expect(edge).not.toMatch(/body\?\.(score|improvementPct|improvement_pct|metricCount|baseline)/);
    expect(edge).not.toContain("family_id:");
  });

  it("locks private baselines and exposes frozen Improvement rows read-only", () => {
    const migration = fs.readFileSync(new URL("../../supabase/migrations/20260910223000_group_team_stage5_improvement.sql", import.meta.url), "utf8");
    expect(migration).toContain("profile_weekly_improvement_baselines");
    expect(migration).toContain("group_weekly_improvement_results");
    expect(migration).toContain("alter table public.profile_weekly_improvement_baselines enable row level security");
    expect(migration).toContain("revoke all on table public.profile_weekly_improvement_baselines from public, anon, authenticated");
    expect(migration).toContain("alter table public.group_weekly_improvement_results enable row level security");
    expect(migration).toContain("grant select on table public.group_weekly_improvement_results to authenticated");
    expect(migration).toContain("private.current_user_group_ids()");
  });
});
