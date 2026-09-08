import { describe, expect, it } from "vitest";
import { buildBadgeStatsV2 } from "./badgeStatsV2.js";

function footballSessionBlock({
  completed = false,
  cancelled = false,
  startedAt = "2026-09-08T06:30:00.000Z",
  actualDurationSec = null,
  withResult = false,
} = {}) {
  return {
    id: "football-session-a",
    typeId: "session",
    label: "Football Skills — Session A",
    cancelled,
    startedAt,
    loggedAt: startedAt,
    session: {
      schemaVersion: 1,
      templateId: "session-a",
      templateVersion: 1,
      displayCode: "A",
      name: "Close Control",
      programmeName: "Football Skills",
      plannedDurationSec: 900,
      actualDurationSec,
      completed,
      movements: [
        {
          templateMovementId: "a-1",
          movementId: "sole-rolls",
          name: "Sole Rolls",
          completed,
          skipped: false,
          trackingMethod: "repetitions",
          trackingConfig: {},
          result: withResult ? { overall: { count: 24 } } : null,
          note: "",
        },
      ],
    },
  };
}

function row(date, block) {
  return {
    date_ymd: date,
    log: {
      weekday: "Tue",
      blocks: [block],
      meta: {},
    },
  };
}

describe("badgeStatsV2 structured Session integration", () => {
  it("counts a completed football Session for streak, behaviour and sport mastery", () => {
    const stats = buildBadgeStatsV2({
      allLogs: [row("2026-09-08", footballSessionBlock({ completed: true }))],
      todayYmd: "2026-09-08",
      isAdult: false,
    });

    expect(stats.streak.currentDays).toBe(1);
    expect(stats.streak.longestDays).toBe(1);
    expect(stats.behaviour.earlyBirdSessions).toBe(1);
    expect(stats.behaviour.nightSessions).toBe(0);
    expect(stats.sportMastery.football.sessions).toBe(1);
    expect(stats.sportMastery.football.days).toBe(1);
    expect(stats.sportMastery.football.lastDate).toBe("2026-09-08");
    expect(stats.lifts.totalSets).toBe(0);
    expect(stats.lifts.totalReps).toBe(0);
  });

  it("keeps a partial Session out of green-day streaks while retaining real activity signals", () => {
    const stats = buildBadgeStatsV2({
      allLogs: [
        row(
          "2026-09-08",
          footballSessionBlock({ completed: false, withResult: true })
        ),
      ],
      todayYmd: "2026-09-08",
      isAdult: false,
    });

    expect(stats.streak.currentDays).toBe(0);
    expect(stats.streak.longestDays).toBe(0);
    expect(stats.behaviour.earlyBirdSessions).toBe(1);
    expect(stats.sportMastery.football.sessions).toBe(1);
    expect(stats.sportMastery.football.days).toBe(1);
  });

  it("ignores a cancelled Session even if its frozen snapshot says complete", () => {
    const stats = buildBadgeStatsV2({
      allLogs: [
        row(
          "2026-09-08",
          footballSessionBlock({ completed: true, cancelled: true, withResult: true })
        ),
      ],
      todayYmd: "2026-09-08",
      isAdult: false,
    });

    expect(stats.streak.currentDays).toBe(0);
    expect(stats.behaviour.earlyBirdSessions).toBe(0);
    expect(stats.sportMastery.football.sessions).toBe(0);
    expect(stats.sportMastery.football.days).toBe(0);
  });

  it("counts recent structured Session activity in recovery training density", () => {
    const sessionSep6 = footballSessionBlock({
      completed: true,
      startedAt: "2026-09-06T16:00:00.000Z",
    });
    const sessionSep7 = footballSessionBlock({
      completed: false,
      withResult: true,
      startedAt: "2026-09-07T16:00:00.000Z",
    });

    const stats = buildBadgeStatsV2({
      allLogs: [row("2026-09-06", sessionSep6), row("2026-09-07", sessionSep7)],
      todayYmd: "2026-09-08",
      isAdult: false,
    });

    expect(stats.recovery.recommendation.reasons.trainingLast5).toBe(2);
    expect(stats.recovery.recommendation.reasons.trainingLast7).toBe(2);
    expect(stats.recovery.recommendation.reasons.consecutiveTrainingBefore).toBe(2);
  });
});
