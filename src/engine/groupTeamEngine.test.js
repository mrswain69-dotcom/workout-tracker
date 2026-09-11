import { describe, expect, it } from "vitest";
import {
  buildTeamConsistency,
  buildTeamImprovementSeries,
  buildTeamSeasonSummary,
  buildTrainingPrSummary,
  extractTrainingPrObservations,
  rankTeamPrRows,
  selectTeamTopThree,
} from "./groupTeamEngine.js";

function strengthLog(date, reps, weight = 0) {
  return {
    date_ymd: date,
    log_json: {
      blocks: [{
        typeId: "strength",
        sets: { squat: [{ reps, weight }] },
      }],
    },
  };
}

function cardioLog(date, distanceKm, durationMin, cardioType = "run") {
  return {
    date_ymd: date,
    log_json: {
      blocks: [{ typeId: "cardio", cardioType, cardio: { distanceKm, durationMin } }],
    },
  };
}

const season = { startDate: "2026-09-07", endDate: "2026-11-01" };

describe("Stage 7 Group team engine", () => {
  it("extracts only comparable strength and cardio training PR observations", () => {
    const rows = extractTrainingPrObservations([
      strengthLog("2026-09-01", 5, 20),
      cardioLog("2026-09-02", 5, 30),
      { date_ymd: "2026-09-03", log_json: { blocks: [{ typeId: "recovery", recoveryDone: true }] } },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ key: "strength:strength:squat:weighted_set_work", value: 100 });
    expect(rows[1].key).toBe("cardio:run:5.0km:speed");
  });

  it("does not call an athlete's first ever comparable performance a PR", () => {
    const summary = buildTrainingPrSummary({
      logs: [strengthLog("2026-09-08", 10)],
      window: season,
      referenceDate: "2026-09-11",
    });
    expect(summary).toMatchObject({ state: "no_prs", prCount: 0, latestPrDate: null });
  });

  it("counts genuine sequential personal records during the eligible season", () => {
    const summary = buildTrainingPrSummary({
      logs: [
        strengthLog("2026-08-20", 10),
        strengthLog("2026-09-08", 11),
        strengthLog("2026-09-09", 11),
        strengthLog("2026-09-10", 13),
      ],
      window: season,
      referenceDate: "2026-09-11",
    });
    expect(summary).toMatchObject({ state: "scored", prCount: 2, latestPrDate: "2026-09-10" });
  });

  it("compares cardio PRs only within the same sport and approximate distance bucket", () => {
    const summary = buildTrainingPrSummary({
      logs: [
        cardioLog("2026-08-20", 5, 30, "run"),
        cardioLog("2026-09-08", 10, 55, "run"),
        cardioLog("2026-09-09", 5, 29, "run"),
      ],
      window: season,
      referenceDate: "2026-09-11",
    });
    expect(summary.prCount).toBe(1);
    expect(summary.latestPrDate).toBe("2026-09-09");
  });

  it("respects member eligibility while retaining earlier history as the personal-best reference", () => {
    const summary = buildTrainingPrSummary({
      logs: [
        strengthLog("2026-08-20", 10),
        strengthLog("2026-09-08", 11),
        strengthLog("2026-09-12", 12),
      ],
      window: season,
      referenceDate: "2026-09-15",
      eligibleFrom: "2026-09-10",
    });
    expect(summary.prCount).toBe(1);
    expect(summary.latestPrDate).toBe("2026-09-12");
  });

  it("preserves genuine PR-count ties and leaves zero-PR athletes unranked", () => {
    const rows = rankTeamPrRows([
      { membership_id: "b", nickname: "Beta", prCount: 3 },
      { membership_id: "a", nickname: "Alpha", prCount: 3 },
      { membership_id: "c", nickname: "Charlie", prCount: 1 },
      { membership_id: "d", nickname: "Delta", prCount: 0 },
    ]);
    expect(rows.map((row) => [row.membership_id, row.rank])).toEqual([
      ["a", 1],
      ["b", 1],
      ["c", 3],
      ["d", null],
    ]);
  });

  it("calculates team Consistency from total planned days rather than averaging athlete percentages", () => {
    const result = buildTeamConsistency([
      { completedDays: 1, plannedDays: 1, consistencyPct: 100, consistencyState: "scored" },
      { completedDays: 1, plannedDays: 3, consistencyPct: 33.3, consistencyState: "scored" },
    ]);
    expect(result).toEqual({
      available: true,
      reason: "scored",
      plannedDays: 4,
      completedDays: 2,
      consistencyPct: 50,
    });
  });

  it("fails team Consistency closed if any eligible athlete lacks schedule truth", () => {
    expect(buildTeamConsistency([
      { completedDays: 2, plannedDays: 2, consistencyState: "scored" },
      { completedDays: 0, plannedDays: 0, consistencyState: "schedule_unavailable" },
    ])).toMatchObject({ available: false, reason: "schedule_unavailable", consistencyPct: null });
  });

  it("uses equal athlete weighting for the weekly team Improvement graph", () => {
    const series = buildTeamImprovementSeries({
      startDate: "2026-09-07",
      endDate: "2026-09-13",
      state: "live",
      available: true,
      rows: [
        { improvementPct: 10, improvementMetricCount: 5 },
        { improvementPct: -2, improvementMetricCount: 1 },
        { improvementPct: null, improvementMetricCount: 0 },
      ],
    }, [{
      startDate: "2026-08-31",
      endDate: "2026-09-06",
      state: "frozen",
      available: true,
      rows: [{ improvementPct: 4, improvementMetricCount: 2 }],
    }]);
    expect(series.map((point) => point.improvementPct)).toEqual([4, 4]);
    expect(series[1].scoredAthletes).toBe(2);
  });

  it("builds a team season summary and keeps Top 3 spotlight metrics independent", () => {
    const period = {
      seasonNumber: 2,
      weekNumber: 3,
      startDate: "2026-09-07",
      endDate: "2026-11-01",
      available: true,
      rows: [
        { membership_id: "a", nickname: "A", xp: 500, xpRank: 1, plannedDays: 4, completedDays: 4, consistencyPct: 100, consistencyRank: 1, improvementPct: 1, improvementMetricCount: 1, improvementRank: 3 },
        { membership_id: "b", nickname: "B", xp: 400, xpRank: 2, plannedDays: 4, completedDays: 3, consistencyPct: 75, consistencyRank: 3, improvementPct: 8, improvementMetricCount: 2, improvementRank: 1 },
        { membership_id: "c", nickname: "C", xp: 300, xpRank: 3, plannedDays: 4, completedDays: 3, consistencyPct: 75, consistencyRank: 3, improvementPct: 4, improvementMetricCount: 2, improvementRank: 2 },
        { membership_id: "d", nickname: "D", xp: 250, xpRank: 4, plannedDays: 0, completedDays: 0, consistencyPct: null, consistencyRank: null, improvementPct: 1, improvementMetricCount: 1, improvementRank: 3 },
      ],
    };
    expect(buildTeamSeasonSummary(period)).toMatchObject({
      seasonNumber: 2,
      weekNumber: 3,
      athleteCount: 4,
      participatingAthletes: 4,
      teamXp: 1450,
      improvementPct: 3.5,
    });
    expect(selectTeamTopThree(period, "xp").map((row) => row.membership_id)).toEqual(["a", "b", "c"]);
    expect(selectTeamTopThree(period, "improvement").map((row) => row.membership_id)).toEqual(["b", "c", "a", "d"]);
  });
});
