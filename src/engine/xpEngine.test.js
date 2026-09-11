import { describe, expect, it } from "vitest";
import {
  XP_ENGINE_SCORE_VERSION,
  buildCompetitionWindow,
  buildXpDebugRows,
  computeXpForWindow,
  computeXpFromLogs,
  getCurrentWeekWindow,
  getPreviousCompletedWeekWindows,
  sumXpRowsInRange,
} from "./xpEngine.js";

function strengthLog(reps) {
  return {
    blocks: [
      {
        id: "strength-a",
        typeId: "strength",
        movements: [{ id: "squat" }],
        sets: { squat: [{ reps, weight: 2 }] },
      },
    ],
  };
}

describe("shared XP truth engine", () => {
  it("preserves strength, progression, day-complete and streak XP", () => {
    const rows = buildXpDebugRows(
      [
        { date_ymd: "2026-09-07", log: strengthLog(10) },
        { date_ymd: "2026-09-08", log: strengthLog(11) },
      ],
      {}
    );

    expect(rows.map((row) => [row.date, row.totalXp])).toEqual([
      ["2026-09-08", 32],
      ["2026-09-07", 17],
    ]);
    expect(rows[0].strengthProgressXp).toBe(10);
    expect(rows[0].streakXp).toBe(5);
    expect(computeXpFromLogs(rows.map((row) => ({ date_ymd: row.date, log: row.date === "2026-09-08" ? strengthLog(11) : strengthLog(10) })), {})).toBe(49);
  });

  it("preserves casual-walk, duration, Session, recovery and task rules", () => {
    const plan = {
      blocksByWeekday: {
        Fri: [
          {
            id: "tasks-a",
            typeId: "tasks",
            tasks: [
              { id: "read", xpValue: 5 },
              { id: "skills", xpValue: 15 },
            ],
          },
        ],
      },
    };

    const rows = buildXpDebugRows(
      [
        {
          date_ymd: "2026-09-07",
          log: { blocks: [{ id: "walk", typeId: "cardio", cardioType: "walk", cardio: { distanceKm: 2, durationMin: 20 } }] },
        },
        {
          date_ymd: "2026-09-09",
          log: { blocks: [{ id: "duration", typeId: "duration", duration: { minutes: 30 } }] },
        },
        {
          date_ymd: "2026-09-11",
          log: { blocks: [{ id: "tasks-a", typeId: "tasks", tasksDone: { read: true, skills: true } }] },
        },
        {
          date_ymd: "2026-09-12",
          log: { blocks: [{ id: "session", typeId: "session", session: { completed: true } }] },
        },
        {
          date_ymd: "2026-09-14",
          log: { blocks: [{ id: "recovery", typeId: "recovery", recoveryDone: true }] },
        },
      ],
      plan
    );

    const byDate = Object.fromEntries(rows.map((row) => [row.date, row]));
    expect(byDate["2026-09-07"].cardioXp).toBe(11);
    expect(byDate["2026-09-07"].totalXp).toBe(21);
    expect(byDate["2026-09-09"].durationXp).toBe(11);
    expect(byDate["2026-09-11"].tasksXp).toBe(20);
    expect(byDate["2026-09-11"].dayCompleteXp).toBe(0);
    expect(byDate["2026-09-12"].sessionXp).toBe(10);
    expect(byDate["2026-09-12"].dayCompleteXp).toBe(10);
    expect(byDate["2026-09-14"].recoveryXp).toBe(5);
    expect(byDate["2026-09-14"].dayCompleteXp).toBe(10);
  });

  it("credits claimed Sport Mastery avatar XP on its claim date even without a workout log", () => {
    const plan = {
      meta: {
        claimedRewards: [
          { key: "sport_avatar_football_bronze", claimedAtYmd: "2026-09-05" },
        ],
      },
    };
    const rows = buildXpDebugRows([], plan);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: "2026-09-05",
      kind: "badge_claim",
      totalXp: 25,
      badgeClaimXp: 25,
    });
    expect(computeXpFromLogs([], plan)).toBe(25);
  });

  it("uses Monday-Sunday current week and four prior completed weeks", () => {
    expect(getCurrentWeekWindow("2026-09-10")).toMatchObject({
      startDate: "2026-09-07",
      endDate: "2026-09-13",
      complete: false,
    });

    expect(getPreviousCompletedWeekWindows("2026-09-10", 4)).toEqual([
      { key: "2026-08-31", startDate: "2026-08-31", endDate: "2026-09-06", complete: true },
      { key: "2026-08-24", startDate: "2026-08-24", endDate: "2026-08-30", complete: true },
      { key: "2026-08-17", startDate: "2026-08-17", endDate: "2026-08-23", complete: true },
      { key: "2026-08-10", startDate: "2026-08-10", endDate: "2026-08-16", complete: true },
    ]);
  });

  it("applies the exact Group-start cutoff inside a partial first week", () => {
    const rows = [
      { date: "2026-09-07", totalXp: 10 },
      { date: "2026-09-08", totalXp: 20 },
      { date: "2026-09-10", totalXp: 30 },
      { date: "2026-09-11", totalXp: 40 },
    ];
    expect(sumXpRowsInRange(rows, "2026-09-07", "2026-09-13", "2026-09-10")).toBe(70);
    expect(sumXpRowsInRange(rows, "2026-09-07", "2026-09-13", "")).toBe(100);
  });

  it("returns stable provenance for arbitrary competition windows so Challenges can reuse the date contract", () => {
    const window = buildCompetitionWindow("2026-09-10", "2026-09-20", { kind: "challenge" });
    const score = computeXpForWindow(
      [{ date_ymd: "2026-09-10", log: strengthLog(10) }],
      {},
      window,
      { eligibleFrom: "2026-09-12" }
    );
    expect(score).toEqual({
      xp: 0,
      startDate: "2026-09-10",
      endDate: "2026-09-20",
      eligibleFrom: "2026-09-12",
      scoreVersion: XP_ENGINE_SCORE_VERSION,
    });
  });
});
