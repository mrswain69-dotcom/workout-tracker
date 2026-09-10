import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { BADGE_DEFS } from "../config/badges.js";
import { BADGE_XP_BY_KEY } from "./xpRewardMap.generated.js";

describe("Stage 3 XP integration", () => {
  it("keeps the generated badge XP lookup in parity with the badge catalogue", () => {
    for (const badge of BADGE_DEFS) {
      expect(BADGE_XP_BY_KEY[badge.key]).toBe(Number(badge.xp) || 0);
    }
    expect(Object.keys(BADGE_XP_BY_KEY).sort()).toEqual(BADGE_DEFS.map((badge) => badge.key).sort());
  });

  it("routes the athlete XP display through the shared engine", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
    expect(app).toContain("computeXpFromLogs as computeXpFromLogsEngine");
    expect(app).toContain("buildXpDebugRows as buildXpDebugRowsEngine");
    expect(app).toContain("setXp(computeXpFromLogsEngine(allLogs, plan))");
    expect(app).toContain("() => buildXpDebugRowsEngine(allLogs, plan)");
  });

  it("deploys the exact shared engine files with the Edge Function", () => {
    const sourceEngine = fs.readFileSync(new URL("./xpEngine.js", import.meta.url), "utf8");
    const edgeEngine = fs.readFileSync(new URL("../../supabase/functions/group-xp-leaderboard/xpEngine.js", import.meta.url), "utf8");
    const sourceRewards = fs.readFileSync(new URL("./xpRewardMap.generated.js", import.meta.url), "utf8");
    const edgeRewards = fs.readFileSync(new URL("../../supabase/functions/group-xp-leaderboard/xpRewardMap.generated.js", import.meta.url), "utf8");
    expect(edgeEngine).toBe(sourceEngine);
    expect(edgeRewards).toBe(sourceRewards);
  });
});
