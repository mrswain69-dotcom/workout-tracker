import { describe, expect, it } from "vitest";
import { buildBadgeStatsV2 } from "./badgeStatsV2.js";
import { hasSportAvatarArtwork } from "../config/sportAvatarArtwork.js";
import { SPORT_MASTERY_PACKS } from "../config/badges.js";

const row = (date, blocks) => ({ date_ymd: date, log: { blocks, meta: {} } });
const hike = (extra = {}) => ({ typeId: "walk", activityName: "Hiking", cardio: { distanceKm: 4, durationMin: 60 }, ...extra });
const stats = allLogs => buildBadgeStatsV2({ allLogs, todayYmd: "2026-10-11", isAdult: true }).sportMastery;

describe("Hiking mastery preparation", () => {
  it("counts explicit hiking activity once per day across blocks and duplicate rows", () => {
    expect(stats([
      row("2026-10-09", [hike(), hike()]), row("2026-10-09", [hike()]),
      row("2026-10-10", [hike({ typeId: "cardio", activityName: "", cardioType: "hiking" })]),
      row("2026-10-11", [{ typeId: "duration", activityName: "Weekend hike", duration: { minutes: 60 } }]),
    ]).hiking).toEqual({ sessions: 3, days: 3, lastDate: "2026-10-11" });
  });

  it("does not turn ordinary walks or unrelated words into hikes", () => {
    expect(stats([
      row("2026-10-08", [hike({ activityName: "Walk to school" })]),
      row("2026-10-09", [hike({ activityName: "", cardioType: "walk" })]),
      row("2026-10-10", [hike({ activityName: "Hitchhiking" })]),
      row("2026-10-11", [hike({ activityName: "Unhiking vocabulary" })]),
    ]).hiking.sessions).toBe(0);
  });

  it("excludes empty, cancelled, recovery-suspended and future hikes", () => {
    expect(stats([
      row("2026-10-07", [hike({ cardio: {} })]),
      row("2026-10-08", [hike({ cancelled: true })]),
      row("2026-10-09", [hike({ suspendedByRecoveryMode: true })]),
      row("2026-10-12", [hike()]),
    ]).hiking.sessions).toBe(0);
  });

  it("preserves existing named sport and native cardio precedence", () => {
    const result = stats([
      row("2026-10-08", [hike({ typeId: "duration", activityName: "Football hiking warmup", duration: { minutes: 20 } })]),
      row("2026-10-09", [hike({ typeId: "run", activityName: "Hiking trail run" })]),
      row("2026-10-10", [hike({ typeId: "bike", activityName: "Hiking trail ride" })]),
    ]);
    expect(result.hiking.sessions).toBe(0);
    expect(result.football.sessions).toBe(1);
    expect(result.running.sessions).toBe(1);
    expect(result.cycling.sessions).toBe(1);
  });

  it("keeps incomplete artwork and reward registration inactive", () => {
    expect(hasSportAvatarArtwork("hiking")).toBe(false);
    expect(SPORT_MASTERY_PACKS.hiking).toBeUndefined();
  });
});
