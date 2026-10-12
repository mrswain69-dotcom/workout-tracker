import { describe, expect, it } from "vitest";
import { buildBadgeStatsV2 } from "./badgeStatsV2.js";
import { hasSportAvatarArtwork } from "../config/sportAvatarArtwork.js";
import { SPORT_MASTERY_PACKS } from "../config/badges.js";
import { resolveAvatarIdentity } from "../config/avatarIdentity.js";
import { getRewardXpForKey } from "./xpEngine.js";

const row = (date, blocks) => ({ date_ymd: date, log: { blocks, meta: {} } });
const pilates = (extra = {}) => ({ typeId: "duration", activityName: "Pilates practice", duration: { minutes: 30 }, ...extra });
const stats = allLogs => buildBadgeStatsV2({ allLogs, todayYmd: "2026-10-16", isAdult: true }).sportMastery;

describe("Pilates mastery release", () => {
  it("preserves historic Pilates routing and starts the new collection on October 13", () => {
    const result = stats([row("2026-10-11", [pilates()]), row("2026-10-12", [pilates()]), row("2026-10-13", [pilates()])]);
    expect(result.yoga.sessions).toBe(2);
    expect(result.pilates).toEqual({ sessions: 1, days: 1, lastDate: "2026-10-13" });
  });

  it("counts named logged activity once per day across blocks and duplicate rows", () => {
    const result = stats([
      row("2026-10-13", [pilates(), pilates()]), row("2026-10-13", [pilates()]),
      row("2026-10-14", [pilates({ typeId: "cardio", activityName: "Mat Pilates", cardio: { durationMin: 20 } })]),
      row("2026-10-15", [{ typeId: "session", session: { programmeName: "Pilates", completed: true, actualDurationSec: 1200, movements: [] } }]),
    ]);
    expect(result.pilates.sessions).toBe(3);
    expect(result.yoga.sessions).toBe(0);
  });

  it("keeps Yoga and Tai Chi routing and avoids Pilates substring matches", () => {
    const result = stats([
      row("2026-10-13", [pilates({activityName:"Yoga Pilates routine"})]),
      row("2026-10-14", [pilates({activityName:"Tai Chi"})]),
      row("2026-10-15", [pilates({activityName:"Pilatesque vocabulary"})]),
    ]);
    expect(result.yoga.sessions).toBe(2);
    expect(result.pilates.sessions).toBe(0);
  });

  it("excludes empty, cancelled, recovery-suspended, future and unrelated block types", () => {
    expect(stats([
      row("2026-10-13", [pilates({duration:{}}), pilates({cancelled:true}), pilates({suspendedByRecoveryMode:true})]),
      row("2026-10-14", [pilates({typeId:"box"}), pilates({typeId:"hiit"})]),
      row("2026-10-17", [pilates()]),
    ]).pilates.sessions).toBe(0);
  });

  it("preserves Football and native cardio/strength precedence", () => {
    const result = stats([
      row("2026-10-13", [pilates({activityName:"Football pilates warmup"})]),
      row("2026-10-14", [{typeId:"run",activityName:"Pilates",cardio:{durationMin:20}}]),
      row("2026-10-15", [{typeId:"bike",activityName:"Pilates",cardio:{durationMin:20}}]),
    ]);
    expect(result.pilates.sessions).toBe(0);
    expect(result.football.sessions).toBe(1);
    expect(result.running.sessions).toBe(1);
    expect(result.cycling.sessions).toBe(1);
  });

  it("shares eight logical unlocks, stories and rewards across appearances", () => {
    expect(hasSportAvatarArtwork("pilates")).toBe(true);
    expect(SPORT_MASTERY_PACKS.pilates.label).toBe("Pilates");
    const tiers=["bronze","silver","gold","platinum","diamond","elite","champion","unreal"];
    const identities=tiers.map(t=>resolveAvatarIdentity(`sport_avatar_pilates_${t}`));
    expect(identities.map(x=>x.unlockSource.requirement.sessions)).toEqual([40,80,120,160,200,240,280,320]);
    expect(tiers.map(t=>getRewardXpForKey(`sport_avatar_pilates_${t}`))).toEqual([25,35,50,70,95,125,160,200]);
    expect(Array.from({length:9},(_,i)=>getRewardXpForKey(`badge_sport_pilates_mastery_${i+1}`))).toEqual([20,30,45,65,90,110,130,160,200]);
    expect(new Set(identities.map(x=>x.story)).size).toBe(8);
    for(const identity of identities){
      expect(identity.story.split(/\s+/).length).toBeGreaterThanOrEqual(30);
      expect(identity.story.split(/\s+/).length).toBeLessThanOrEqual(70);
      expect(resolveAvatarIdentity(identity.id,{edition:"paired_v2",variant:"female"}).unlockSource).toEqual(identity.unlockSource);
    }
  });
});
