import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("Group Stage 3 integration contract", () => {
  it("keeps Group mutations server-authorized and leaderboard scoring in the Edge Function", () => {
    const db = fs.readFileSync(new URL("./groupDb.js", import.meta.url), "utf8");
    expect(db).toContain('supabase.functions.invoke("group-xp-leaderboard"');
    expect(db).toContain('supabase.rpc("group_update_xp_history_scope"');
    expect(db).not.toMatch(/from("group_weekly_xp_results").*.(insert|update|upsert|delete)/s);
  });

  it("renders Weekly XP before the member-management panel", () => {
    const hub = fs.readFileSync(new URL("./GroupHub.jsx", import.meta.url), "utf8");
    expect(hub.indexOf("<GroupWeeklyXp")).toBeGreaterThan(-1);
    expect(hub.indexOf("<GroupWeeklyXp")).toBeLessThan(hub.indexOf("<h4>Members</h4>"));
  });

  it("does not add untruthful Improvement or Consistency leaderboard placeholders", () => {
    const weekly = fs.readFileSync(new URL("./GroupWeeklyXp.jsx", import.meta.url), "utf8");
    expect(weekly).not.toContain("Improvement leaderboard");
    expect(weekly).not.toContain("Consistency leaderboard");
  });

  it("keeps raw scoring private and preserves relevant former members in closed weeks", () => {
    const edge = fs.readFileSync(new URL("../../supabase/functions/group-xp-leaderboard/index.ts", import.meta.url), "utf8");
    expect(edge).toContain("Active Group membership required");
    expect(edge).toContain('member.status === "active"');
    expect(edge).toContain("joinedDate <= window.endDate");
    expect(edge).toContain("leftDate >= window.startDate");
    expect(edge).not.toMatch(/body?.(xp|score)/);
  });
});
