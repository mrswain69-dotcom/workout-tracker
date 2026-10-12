import { describe, expect, it } from "vitest";
import { buildBadgeStatsV2 } from "./badgeStatsV2.js";
import { hasSportAvatarArtwork } from "../config/sportAvatarArtwork.js";
import { SPORT_MASTERY_PACKS } from "../config/badges.js";
import { resolveAvatarIdentity } from "../config/avatarIdentity.js";
import { getRewardXpForKey } from "./xpEngine.js";

const row = (date, blocks) => ({ date_ymd: date, log: { blocks, meta: {} } });
const boxing = (extra = {}) => ({ typeId: "duration", activityName: "Boxing practice", duration: { minutes: 30 }, ...extra });
const stats = allLogs => buildBadgeStatsV2({ allLogs, todayYmd: "2026-10-16", isAdult: true }).sportMastery;

describe("Boxing mastery release", () => {
  it("preserves historic Boxing routing and starts the new collection on October 13", () => {
    const result = stats([row("2026-10-11", [boxing()]), row("2026-10-12", [boxing()]), row("2026-10-13", [boxing()])]);
    expect(result.martial_arts.sessions).toBe(2);
    expect(result.boxing).toEqual({ sessions: 1, days: 1, lastDate: "2026-10-13" });
  });

  it("counts named logged activity once per day across blocks and duplicate rows", () => {
    const result = stats([
      row("2026-10-13", [boxing(), boxing()]), row("2026-10-13", [boxing()]),
      row("2026-10-14", [boxing({ typeId: "cardio", activityName: "Boxercise", cardio: { durationMin: 20 } })]),
      row("2026-10-15", [{ typeId: "session", session: { programmeName: "Boxing", completed: true, actualDurationSec: 1200, movements: [] } }]),
    ]);
    expect(result.boxing.sessions).toBe(3);
    expect(result.martial_arts.sessions).toBe(0);
  });

  it("keeps kickboxing and Muay Thai under Martial Arts and avoids substring matches", () => {
    const result = stats([
      row("2026-10-13", [boxing({activityName:"Kickboxing"})]),
      row("2026-10-14", [boxing({activityName:"Muay Thai boxing"})]),
      row("2026-10-15", [boxing({activityName:"Unboxing parcels"})]),
    ]);
    expect(result.martial_arts.sessions).toBe(2);
    expect(result.boxing.sessions).toBe(0);
  });

  it("excludes empty, cancelled, recovery-suspended, future and retired native blocks", () => {
    expect(stats([
      row("2026-10-13", [boxing({duration:{}}), boxing({cancelled:true}), boxing({suspendedByRecoveryMode:true})]),
      row("2026-10-14", [boxing({typeId:"boxercise"}), boxing({typeId:"hiit"})]),
      row("2026-10-17", [boxing()]),
    ]).boxing.sessions).toBe(0);
  });

  it("preserves Football and native cardio/strength precedence", () => {
    const result = stats([
      row("2026-10-13", [boxing({activityName:"Football boxing warmup"})]),
      row("2026-10-14", [{typeId:"run",activityName:"Boxing",cardio:{durationMin:20}}]),
      row("2026-10-15", [{typeId:"bike",activityName:"Boxing",cardio:{durationMin:20}}]),
    ]);
    expect(result.boxing.sessions).toBe(0);
    expect(result.football.sessions).toBe(1);
    expect(result.running.sessions).toBe(1);
    expect(result.cycling.sessions).toBe(1);
  });

  it("shares eight logical unlocks, stories and rewards across appearances", () => {
    expect(hasSportAvatarArtwork("boxing")).toBe(true);
    expect(SPORT_MASTERY_PACKS.boxing.label).toBe("Boxing");
    const tiers=["bronze","silver","gold","platinum","diamond","elite","champion","unreal"];
    const identities=tiers.map(t=>resolveAvatarIdentity(`sport_avatar_boxing_${t}`));
    expect(identities.map(x=>x.unlockSource.requirement.sessions)).toEqual([40,80,120,160,200,240,280,320]);
    expect(tiers.map(t=>getRewardXpForKey(`sport_avatar_boxing_${t}`))).toEqual([25,35,50,70,95,125,160,200]);
    expect(Array.from({length:9},(_,i)=>getRewardXpForKey(`badge_sport_boxing_mastery_${i+1}`))).toEqual([20,30,45,65,90,110,130,160,200]);
    expect(new Set(identities.map(x=>x.story)).size).toBe(8);
    for(const identity of identities){
      expect(identity.story.split(/\s+/).length).toBeGreaterThanOrEqual(30);
      expect(identity.story.split(/\s+/).length).toBeLessThanOrEqual(70);
      expect(resolveAvatarIdentity(identity.id,{edition:"paired_v2",variant:"female"}).unlockSource).toEqual(identity.unlockSource);
    }
  });
});
