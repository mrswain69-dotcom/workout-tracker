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

it("counts each sport once per day across duplicate rows and excludes future days", () => {
  const block = footballSessionBlock({completed:true});
  const stats = buildBadgeStatsV2({allLogs:[row("2026-09-08",block),row("2026-09-07",block),row("2026-09-08",block),row("2026-09-09",block)],todayYmd:"2026-09-08",isAdult:false});
  expect(stats.sportMastery.football).toEqual({sessions:2,days:2,lastDate:"2026-09-08"});
});

it("counts strength prestige training days once and ignores cancelled/future rows",()=>{
  const block={id:"strength",typeId:"strength",sets:{squat:Array.from({length:10},()=>({reps:5,weight:20}))}};
  const stats=buildBadgeStatsV2({todayYmd:"2026-10-08",isAdult:true,allLogs:[row("2026-10-07",block),row("2026-10-07",block),row("2026-10-09",block),row("2026-10-06",{...block,cancelled:true})]});
  expect(stats.sessions.strengthTrainingDays).toBe(1);
  expect(stats.sessions.strengthTrainingDates).toEqual(["2026-10-07"]);
});
it("counts pace improvement prestige once per qualifying date across sports",()=>{
  const cardio=(sport,min)=>({id:sport,typeId:"cardio",cardioType:sport,cardio:{sport,distanceKm:5,durationMin:min}});
  const logs=[row("2026-08-20",cardio("run",30)),row("2026-09-20",cardio("run",24)),row("2026-09-20",cardio("run",24)),row("2026-10-09",cardio("run",20))];
  const stats=buildBadgeStatsV2({allLogs:logs,todayYmd:"2026-10-08",isAdult:true});
  expect(stats.intelligence.paceImprovementDays).toBe(1);
  expect(stats.intelligence.paceImprovementDates).toEqual(["2026-09-20"]);
});
