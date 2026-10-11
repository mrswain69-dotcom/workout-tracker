import { describe, expect, it } from "vitest";
import { buildBadgeStatsV2 } from "./badgeStatsV2.js";
import { getRewardXpForKey } from "./xpEngine.js";
import { resolveAvatarIdentity } from "../config/avatarIdentity.js";
const row = (date, blocks) => ({ date_ymd: date, log: { blocks, meta: {} } });
const strength = (extra = {}) => ({ typeId: "strength", sets: { squat: [{ reps: 8, weight: 10 }] }, ...extra });
const stats = allLogs => buildBadgeStatsV2({ allLogs, todayYmd: "2026-10-11", isAdult: true }).sportMastery;
describe("Strength Training mastery", () => {
  it("counts performed sets and named training once per sport/day", () => {
    const result = stats([
      row("2026-10-09", [strength(), strength()]), row("2026-10-09", [strength()]),
      row("2026-10-10", [strength({ sets: { plank: [{ timeSeconds: 30 }] } })]),
      row("2026-10-11", [{ typeId: "duration", activityName: "Resistance training", duration: { minutes: 20 } }]),
    ]);
    expect(result.strength_training).toEqual({ sessions: 3, days: 3, lastDate: "2026-10-11" });
  });
  it("excludes empty plans, weight-only entries, cancellations, recovery and future sets", () => {
    expect(stats([
      row("2026-10-07", [strength({ sets: {} })]), row("2026-10-08", [strength({ sets: { squat: [{ weight: 30 }] } })]),
      row("2026-10-09", [strength({ cancelled: true })]), row("2026-10-10", [strength({ suspendedByRecoveryMode: true })]),
      row("2026-10-12", [strength()]),
    ]).strength_training.sessions).toBe(0);
  });
  it("preserves named sport precedence and legacy HIIT/Box separation", () => {
    const result = stats([
      row("2026-10-08", [strength({ typeId: "hiit" }), strength({ typeId: "box" })]),
      row("2026-10-09", [{ typeId: "duration", activityName: "Football strength training", duration: { minutes: 20 } }]),
      row("2026-10-10", [{ typeId: "duration", activityName: "Unweightlifting word", duration: { minutes: 20 } }]),
    ]);
    expect(result.strength_training.sessions).toBe(0); expect(result.football.sessions).toBe(1);
  });
  it("shares eight unlocks and stories with unchanged tier XP across appearances", () => {
    const tiers = ["bronze", "silver", "gold", "platinum", "diamond", "elite", "champion", "unreal"];
    const identities = tiers.map(t => resolveAvatarIdentity(`sport_avatar_strength_training_${t}`));
    expect(identities.map(x => x.unlockSource.requirement.sessions)).toEqual([40, 80, 120, 160, 200, 240, 280, 320]);
    expect(tiers.map(t => getRewardXpForKey(`sport_avatar_strength_training_${t}`))).toEqual([25, 35, 50, 70, 95, 125, 160, 200]);
    expect(Array.from({ length: 9 }, (_, i) => getRewardXpForKey(`badge_sport_strength_training_mastery_${i + 1}`))).toEqual([20, 30, 45, 65, 90, 110, 130, 160, 200]);
    expect(new Set(identities.map(x => x.story)).size).toBe(8);
    for (const identity of identities) {
      expect(identity.story.split(/\s+/).length).toBeGreaterThanOrEqual(30); expect(identity.story.split(/\s+/).length).toBeLessThanOrEqual(70);
      expect(resolveAvatarIdentity(identity.id, { edition: "paired_v2", variant: "female" }).unlockSource).toEqual(identity.unlockSource);
    }
  });
});
