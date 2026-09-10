import { describe, expect, it } from "vitest";
import {
  buildProgressViewModel,
  formatProgressRangeLabel,
} from "./progressViewModel.js";

function baseTraining(overrides = {}) {
  return {
    hasStructuredSessionHistory: true,
    week: { completedSessions: 2 },
    month: { completedSessions: 5 },
    recent28: {
      completedSessions: 4,
      partialSessions: 1,
      activeSessionDays: 4,
      totalMinutes: 75,
      recordedExecutions: 120,
      attempts: 20,
      successes: 16,
      accuracyPct: 80,
    },
    lifetime: { completedSessions: 8, partialSessions: 1 },
    trainingTrend: [
      {
        startDate: "2026-08-14",
        endDate: "2026-08-20",
        completedSessions: 1,
        partialSessions: 0,
        activeSessionDays: 1,
        totalMinutes: 15,
        recordedExecutions: 25,
      },
      {
        startDate: "2026-08-21",
        endDate: "2026-08-27",
        completedSessions: 0,
        partialSessions: 1,
        activeSessionDays: 1,
        totalMinutes: 10,
        recordedExecutions: 10,
      },
      {
        startDate: "2026-08-28",
        endDate: "2026-09-03",
        completedSessions: 1,
        partialSessions: 0,
        activeSessionDays: 1,
        totalMinutes: 20,
        recordedExecutions: 35,
      },
      {
        startDate: "2026-09-04",
        endDate: "2026-09-10",
        completedSessions: 2,
        partialSessions: 0,
        activeSessionDays: 1,
        totalMinutes: 30,
        recordedExecutions: 50,
      },
    ],
    sessionBalance: [
      { templateId: "a", displayCode: "A", name: "Close Control", count: 2 },
      { templateId: "b", displayCode: "B", name: "First Touch", count: 1 },
      { templateId: "c", displayCode: "C", name: "Weak Foot", count: 1 },
    ],
    movementTotals: [
      {
        movementId: "movement-low",
        name: "First Touch",
        timesPerformed: 1,
        attempts: 10,
        successes: 8,
        accuracyPct: 80,
        bestScore: null,
        recordedExecutions: 8,
        lastPerformedDate: "2026-09-08",
        measures: {
          executions: { kind: "executions", value: 8 },
          accuracy: {
            kind: "attempts_successes",
            attempts: 10,
            successes: 8,
            percentage: 80,
          },
          bestScore: null,
        },
      },
      {
        movementId: "movement-high",
        name: "Sole Rolls",
        timesPerformed: 3,
        attempts: 0,
        successes: 0,
        accuracyPct: null,
        bestScore: null,
        recordedExecutions: 75,
        lastPerformedDate: "2026-09-10",
        measures: {
          executions: { kind: "executions", value: 75 },
          accuracy: null,
          bestScore: null,
        },
      },
      {
        movementId: "movement-score",
        name: "Weak-Foot Keepy-Uppys",
        timesPerformed: 2,
        attempts: 0,
        successes: 0,
        accuracyPct: null,
        bestScore: 18,
        recordedExecutions: 0,
        lastPerformedDate: "2026-09-09",
        measures: {
          executions: null,
          accuracy: null,
          bestScore: { kind: "best_score", value: 18 },
        },
      },
    ],
    ...overrides,
  };
}

describe("Phase 3 Stage 5 Progress view model", () => {
  it("formats the four rolling chart ranges without changing the date contract", () => {
    expect(formatProgressRangeLabel("2026-08-14", "2026-08-20")).toBe("14–20 Aug");
    expect(formatProgressRangeLabel("2026-08-28", "2026-09-03")).toBe("28 Aug–3 Sept");
  });

  it("adds last-28-day training cards and keeps accuracy typed", () => {
    const model = buildProgressViewModel({ trainingProgress: baseTraining() });

    expect(model.training.completedSessions28).toBe(4);
    expect(model.training.partialSessions28).toBe(1);
    expect(model.training.activeSessionDays28).toBe(4);
    expect(model.training.trainingMinutes28).toBe(75);
    expect(model.training.recordedExecutions28).toBe(120);
    expect(model.training.attempts28).toBe(20);
    expect(model.training.successes28).toBe(16);
    expect(model.training.accuracyPct28).toBe(80);
    expect(model.training.trainingTrend.map((row) => row.label)).toEqual([
      "14–20 Aug",
      "21–27 Aug",
      "28 Aug–3 Sept",
      "4–10 Sept",
    ]);
    expect(model.training.hasTrendActivity).toBe(true);
  });

  it("turns Session Balance into truthful distribution percentages", () => {
    const model = buildProgressViewModel({ trainingProgress: baseTraining() });

    expect(model.training.sessionDistributionTotal).toBe(4);
    expect(model.training.sessionBalance.map((row) => [row.displayCode, row.sharePct])).toEqual([
      ["A", 50],
      ["B", 25],
      ["C", 25],
    ]);
  });

  it("sorts Movement totals by practice frequency while preserving unlike measures separately", () => {
    const model = buildProgressViewModel({ trainingProgress: baseTraining() });

    expect(model.training.movementTotals.map((row) => row.name)).toEqual([
      "Sole Rolls",
      "Weak-Foot Keepy-Uppys",
      "First Touch",
    ]);
    expect(model.training.movementTotals[0].measures.executions).toEqual({
      kind: "executions",
      value: 75,
    });
    expect(model.training.movementTotals[1].measures.bestScore).toEqual({
      kind: "best_score",
      value: 18,
    });
    expect(model.training.movementTotals[2].measures.accuracy).toEqual({
      kind: "attempts_successes",
      attempts: 10,
      successes: 8,
      percentage: 80,
    });
  });

  it("keeps a zeroed 28-day chart deliberately empty even when four buckets exist", () => {
    const zeroTrend = baseTraining({
      hasStructuredSessionHistory: false,
      lifetime: { completedSessions: 0, partialSessions: 0 },
      trainingTrend: [
        { startDate: "2026-08-14", endDate: "2026-08-20" },
        { startDate: "2026-08-21", endDate: "2026-08-27" },
        { startDate: "2026-08-28", endDate: "2026-09-03" },
        { startDate: "2026-09-04", endDate: "2026-09-10" },
      ],
      movementTotals: [],
      sessionBalance: [],
    });

    const model = buildProgressViewModel({ trainingProgress: zeroTrend });
    expect(model.training.hasTrendActivity).toBe(false);
    expect(model.training.movementCount).toBe(0);
  });
});
