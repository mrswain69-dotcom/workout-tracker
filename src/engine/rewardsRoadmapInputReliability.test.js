import fs from "node:fs";
import { describe, expect, it } from "vitest";

function functionSlice(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) return "";
  const end = nextName ? source.indexOf(`function ${nextName}`, start + 1) : -1;
  return source.slice(start, end > start ? end : start + 9000);
}

describe("Rewards roadmap and log input reliability", () => {
  it("never lets an in-flight day load replace a newer optimistic edit", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

    expect(app).toContain("const revisionAtLoadStart");
    expect(app).toContain("const liveCached = cacheKey");
    expect(app).toContain("const editedWhileLoading = liveRevision !== revisionAtLoadStart");
    expect(app).toContain("const rawLatest = liveCached || fromDb || null");
    expect(app).toContain("Never let the result of an older load overwrite an edit");
  });

  it("applies typed log changes before waiting for audio feedback", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
    const handlers = [
      ["addOrUpdateSet", "updateCardio"],
      ["updateCardio", "updateCustom"],
      ["updateCustom", "toggleStreakSaver"],
      ["updateCardioForBlock", "updateDurationForBlock"],
      ["updateDurationForBlock", "prepareSessionBlockForLogging"],
      ["updateProfileRecoveryMinutes", "toggleBlockCancelled"],
      ["updateStrengthSetsForMovement", "toggleTaskForBlock"],
    ];

    for (const [name, nextName] of handlers) {
      const body = functionSlice(app, name, nextName);
      expect(body, `${name} should exist`).not.toBe("");
      expect(body.indexOf("await saveLog")).toBeGreaterThanOrEqual(0);
      expect(body.indexOf("await ensureAudio()")).toBeGreaterThan(
        body.indexOf("await saveLog")
      );
    }
  });

  it("uses a visual XP split and a moving avatar roadmap", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

    expect(app).toContain('className="rewardsXpBreakdown"');
    expect(app).toContain('className="rewardsXpTotal"');
    expect(app).toContain("rewardsRoadmap.nextAvatar");
    expect(app).toContain("rewardsMilestoneProgressFill");
    expect(app).toContain("Your progression");
    expect(app).toContain("This roadmap moves with you.");
    expect(app).toContain("rewardsRoadmap.followingAvatar");
  });
});
