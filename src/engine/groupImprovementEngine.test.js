import { describe, expect, it } from "vitest";
import {
  IMPROVEMENT_METRIC_CAP_PCT,
  buildImprovementBaseline,
  extractAssessmentImprovementObservations,
  extractWorkoutImprovementObservations,
  getCurrentImprovementWeekWindow,
  getPreviousCompletedImprovementWeekWindows,
  rankImprovementRows,
  scoreImprovementWindow,
} from "./groupImprovementEngine.js";

function strengthLog(date, movement, sets) {
  return {
    date_ymd: date,
    log: { blocks: [{ id: `b-${date}`, typeId: "strength", sets: { [movement]: sets } }] },
  };
}

function cardioLog(date, speed, distance = 5) {
  return {
    date_ymd: date,
    log: { blocks: [{ id: `r-${date}`, typeId: "cardio", cardioType: "run", cardio: { distanceKm: distance, durationMin: (distance / speed) * 60, avgSpeedKmh: speed } }] },
  };
}

describe("Group Improvement engine", () => {
  it("uses Monday-Sunday windows and the previous completed four weeks", () => {
    expect(getCurrentImprovementWeekWindow("2026-09-10")).toEqual({
      key: "2026-09-07",
      startDate: "2026-09-07",
      endDate: "2026-09-13",
      complete: false,
    });
    expect(getPreviousCompletedImprovementWeekWindows("2026-09-10", 2).map((week) => week.startDate)).toEqual([
      "2026-08-31",
      "2026-08-24",
    ]);
  });

  it("extracts best-set work for weighted strength without rewarding extra sets", () => {
    const observations = extractWorkoutImprovementObservations([
      strengthLog("2026-09-08", "Goblet Squat", [
        { reps: 10, weight: 10 },
        { reps: 8, weight: 14 },
        { reps: 5, weight: 20 },
      ]),
    ]);
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      key: "training:strength:goblet-squat:weighted_set_work",
      value: 112,
      direction: "higher",
    });
  });

  it("keeps cardio comparison to the same sport and approximate distance rather than raw distance volume", () => {
    const observations = extractWorkoutImprovementObservations([
      cardioLog("2026-09-08", 12, 5.1),
      cardioLog("2026-09-09", 14, 3),
    ]);
    expect(observations.map((row) => row.key)).toEqual([
      "cardio:run:5.0km:speed",
      "cardio:run:3.0km:speed",
    ]);
  });

  it("uses safe Assessment comparable values and respects lower-is-better direction", () => {
    const runs = [
      { id: "run-1", status: "completed", date_ymd: "2026-09-08" },
    ];
    const results = [{
      assessment_run_id: "run-1",
      test_id: "sprint-20m",
      is_valid: true,
      comparable_value: 3.2,
      metric_snapshot: {
        metricType: "time",
        unit: "s",
        scoringDirection: "lower",
        metricConfig: { percentageImprovement: "allow" },
      },
    }];
    const observations = extractAssessmentImprovementObservations({ runs, results });
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({ source: "assessment", direction: "lower", value: 3.2 });
  });

  it("excludes Assessment metrics where percentage change is explicitly unsafe", () => {
    const observations = extractAssessmentImprovementObservations({
      runs: [{ id: "run-1", status: "completed", date_ymd: "2026-09-08" }],
      results: [{
        assessment_run_id: "run-1",
        test_id: "signed-test",
        is_valid: true,
        comparable_value: -2,
        metric_snapshot: {
          metricType: "numeric",
          unit: "score",
          scoringDirection: "higher",
          allowNegative: true,
          metricConfig: {},
        },
      }],
    });
    expect(observations).toEqual([]);
  });

  it("compares current-week average performance with the preceding 28-day baseline average", () => {
    const window = getCurrentImprovementWeekWindow("2026-09-10");
    const workoutLogs = [
      cardioLog("2026-08-17", 10),
      cardioLog("2026-08-24", 10),
      cardioLog("2026-08-31", 10),
      cardioLog("2026-09-02", 10),
      cardioLog("2026-09-08", 11),
      cardioLog("2026-09-10", 13),
    ];
    const score = scoreImprovementWindow({ window, referenceDate: "2026-09-10", workoutLogs });
    expect(score.reason).toBe("scored");
    expect(score.improvementPct).toBe(20);
    expect(score.metricCount).toBe(1);
    expect(score.improvedMetricCount).toBe(1);
    expect(score.baselineStart).toBe("2026-08-10");
    expect(score.baselineEnd).toBe("2026-09-06");
  });

  it("averages metric percentages rather than summing them, so more metric types are not an automatic advantage", () => {
    const window = getCurrentImprovementWeekWindow("2026-09-10");
    const oneMetric = scoreImprovementWindow({
      window,
      referenceDate: "2026-09-10",
      workoutLogs: [cardioLog("2026-08-20", 10), cardioLog("2026-09-08", 11)],
    });
    const twoMetrics = scoreImprovementWindow({
      window,
      referenceDate: "2026-09-10",
      workoutLogs: [
        cardioLog("2026-08-20", 10, 5), cardioLog("2026-09-08", 11, 5),
        cardioLog("2026-08-21", 12, 3), cardioLog("2026-09-09", 13.2, 3),
      ],
    });
    expect(oneMetric.improvementPct).toBe(10);
    expect(twoMetrics.improvementPct).toBe(10);
    expect(twoMetrics.metricCount).toBe(2);
  });

  it("includes declines rather than cherry-picking only positive metrics", () => {
    const window = getCurrentImprovementWeekWindow("2026-09-10");
    const score = scoreImprovementWindow({
      window,
      referenceDate: "2026-09-10",
      workoutLogs: [
        cardioLog("2026-08-20", 10, 5), cardioLog("2026-09-08", 12, 5),
        cardioLog("2026-08-21", 10, 3), cardioLog("2026-09-09", 8, 3),
      ],
    });
    expect(score.improvementPct).toBe(0);
    expect(score.improvedMetricCount).toBe(1);
    expect(score.declinedMetricCount).toBe(1);
  });

  it("caps each metric signal before the composite so a tiny baseline cannot dominate", () => {
    const window = getCurrentImprovementWeekWindow("2026-09-10");
    const score = scoreImprovementWindow({
      window,
      referenceDate: "2026-09-10",
      workoutLogs: [cardioLog("2026-08-20", 1), cardioLog("2026-09-08", 4)],
    });
    expect(score.improvementPct).toBe(IMPROVEMENT_METRIC_CAP_PCT);
    expect(score.cappedMetricCount).toBe(1);
  });

  it("can score from a locked baseline snapshot rather than recalculating prior history", () => {
    const window = getCurrentImprovementWeekWindow("2026-09-10");
    const baseline = buildImprovementBaseline({
      window,
      workoutLogs: [cardioLog("2026-08-20", 10)],
    });
    const score = scoreImprovementWindow({
      window,
      referenceDate: "2026-09-10",
      workoutLogs: [cardioLog("2026-08-20", 2), cardioLog("2026-09-08", 11)],
      baselineMetrics: baseline,
    });
    expect(score.improvementPct).toBe(10);
  });

  it("distinguishes no current performance from no comparable baseline", () => {
    const window = getCurrentImprovementWeekWindow("2026-09-10");
    expect(scoreImprovementWindow({
      window,
      referenceDate: "2026-09-10",
      workoutLogs: [cardioLog("2026-08-20", 10)],
    }).reason).toBe("no_current_performance");
    expect(scoreImprovementWindow({
      window,
      referenceDate: "2026-09-10",
      workoutLogs: [cardioLog("2026-09-08", 11)],
    }).reason).toBe("no_comparable_baseline");
  });

  it("ranks only comparable scores and preserves genuine ties without metric-count tiebreaks", () => {
    const rows = rankImprovementRows([
      { membership_id: "a", nickname: "Alpha", improvementPct: 8, metricCount: 1 },
      { membership_id: "b", nickname: "Beta", improvementPct: 8, metricCount: 9 },
      { membership_id: "c", nickname: "Charlie", improvementPct: -2, metricCount: 3 },
      { membership_id: "d", nickname: "Delta", improvementPct: null, metricCount: 0 },
    ]);
    expect(rows.map((row) => row.rank)).toEqual([1, 1, 3, null]);
  });
});
