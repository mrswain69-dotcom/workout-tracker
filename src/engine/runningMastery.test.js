import { describe, expect, it } from "vitest";
import { buildBadgeStatsV2 } from "./badgeStatsV2.js";
import { getRewardXpForKey } from "./xpEngine.js";
import { resolveAvatarIdentity } from "../config/avatarIdentity.js";

const row = (date, blocks) => ({ date_ymd: date, log: { blocks, meta: {} } });
const run = (extra = {}) => ({ typeId: "run", cardio: { distanceKm: 3, durationMin: 20 }, ...extra });
const stats = allLogs => buildBadgeStatsV2({ allLogs, todayYmd: "2026-10-10", isAdult: true }).sportMastery;

describe("Running mastery release", () => {
  it("counts real native runs and named cardio/duration activity once per day across duplicate rows", () => {
    const result = stats([
      row("2026-10-08", [run(), run()]),
      row("2026-10-08", [run()]),
      row("2026-10-09", [run({ typeId: "cardio", cardioType: "run" })]),
      row("2026-10-10", [{ typeId: "duration", activityName: "Trail running", duration: { minutes: 30 } }]),
    ]);
    expect(result.running).toEqual({ sessions: 3, days: 3, lastDate: "2026-10-10" });
  });
  it("excludes empty plans, cancelled, recovery-suspended and future runs", () => {
    expect(stats([
      row("2026-10-07", [run({ cardio: {} })]),
      row("2026-10-08", [run({ cancelled: true })]),
      row("2026-10-09", [run({ suspendedByRecoveryMode: true })]),
      row("2026-10-11", [run()]),
    ]).running.sessions).toBe(0);
  });
  it("recognises historic named running sessions without unrelated substring matches", () => {
    const result = stats([
      row("2026-10-08", [run({ typeId: "duration", activityName: "Road run", duration: { minutes: 15 } })]),
      row("2026-10-09", [run({ typeId: "duration", activityName: "Outrunning distractions", duration: { minutes: 15 } })]),
      row("2026-10-10", [run({ typeId: "cardio", activityName: "Football running drills", cardioType: "team_sport" })]),
    ]);
    expect(result.running.sessions).toBe(1);
    expect(result.football.sessions).toBe(1);
  });
  it("shares eight unlocks across appearances, with complete stories and unchanged XP progression", () => {
    const tiers = ["bronze", "silver", "gold", "platinum", "diamond", "elite", "champion", "unreal"];
    const identities = tiers.map(tier => resolveAvatarIdentity(`sport_avatar_running_${tier}`));
    expect(identities.map(x => x.unlockSource.requirement.sessions)).toEqual([40, 80, 120, 160, 200, 240, 280, 320]);
    expect(tiers.map(tier => getRewardXpForKey(`sport_avatar_running_${tier}`))).toEqual([25, 35, 50, 70, 95, 125, 160, 200]);
    expect(Array.from({ length: 9 }, (_, i) => getRewardXpForKey(`badge_sport_running_mastery_${i + 1}`))).toEqual([20, 30, 45, 65, 90, 110, 130, 160, 200]);
    expect(new Set(identities.map(x => x.story)).size).toBe(8);
    for (const identity of identities) {
      expect(identity.story.split(/\s+/).length).toBeGreaterThanOrEqual(30);
      expect(identity.story.split(/\s+/).length).toBeLessThanOrEqual(70);
      expect(resolveAvatarIdentity(identity.id, { edition: "paired_v2", variant: "female" }).unlockSource).toEqual(identity.unlockSource);
    }
  });
});
