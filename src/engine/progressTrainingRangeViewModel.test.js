import { describe, expect, it } from "vitest";
import { buildTrainingRangeViewModel } from "./progressTrainingRangeViewModel.js";

function range({ label, startDate = "", endDate = "", displayEndDate = "", completed = 0, minutes = 0, attempts = 0, successes = 0, accuracyPct = null, count = 0, monthKey = "" } = {}) {
  return {
    label,
    startDate,
    endDate,
    displayEndDate,
    summary: {
      completedSessions: completed,
      partialSessions: 0,
      activeSessionDays: completed,
      totalMinutes: minutes,
      recordedExecutions: completed * 20,
      attempts,
      successes,
      accuracyPct,
    },
    trend: completed
      ? [{ startDate: startDate || "2026-09-01", endDate: displayEndDate || endDate || "2026-09-10", monthKey, completedSessions: completed, totalMinutes: minutes }]
      : [],
    sessionBalance: [
      { templateId: "a", displayCode: "A", name: "Close Control", count, lastCompletedDate: count ? "2026-09-09" : "" },
      { templateId: "b", displayCode: "B", name: "First Touch", count: 0, lastCompletedDate: "" },
    ],
    movementTotals: completed
      ? [{
          movementId: "sole-rolls",
          name: "Sole Rolls",
          timesPerformed: completed,
          lastPerformedDate: "2026-09-09",
          measures: { executions: { kind: "executions", value: completed * 20 }, accuracy: null, bestScore: null },
        }]
      : [],
  };
}

describe("Phase 3 Stage 7 training range view model", () => {
  it("exposes one stable three-option range control with Last 4 weeks as default", () => {
    const model = buildTrainingRangeViewModel({});
    expect(model.defaultRangeKey).toBe("recent28");
    expect(model.options).toEqual([
      { key: "recent28", label: "Last 4 weeks" },
      { key: "month", label: "This month" },
      { key: "lifetime", label: "All time" },
    ]);
  });

  it("keeps range summary, Session mix and Movement totals aligned to one selection", () => {
    const model = buildTrainingRangeViewModel({
      recent28: range({ label: "Last 4 weeks", startDate: "2026-08-14", endDate: "2026-09-10", completed: 2, minutes: 30, count: 2 }),
      month: range({ label: "This month", startDate: "2026-09-01", endDate: "2026-09-30", displayEndDate: "2026-09-10", completed: 1, minutes: 10, count: 1 }),
      lifetime: range({ label: "All time", completed: 4, minutes: 65, count: 4, monthKey: "2026-09" }),
    });

    expect(model.ranges.recent28).toMatchObject({ completedSessions: 2, totalMinutes: 30, sessionDistributionTotal: 2 });
    expect(model.ranges.month).toMatchObject({ completedSessions: 1, totalMinutes: 10, sessionDistributionTotal: 1 });
    expect(model.ranges.lifetime).toMatchObject({ completedSessions: 4, totalMinutes: 65, sessionDistributionTotal: 4 });
    expect(model.ranges.month.movementTotals[0].measures.executions.value).toBe(20);
    expect(model.ranges.month.dateLabel).toBe("1–10 Sept");
    expect(model.ranges.lifetime.trend[0].label).toBe("Sept 2026");
  });

  it("preserves attempts/successes accuracy and formats finite date labels", () => {
    const model = buildTrainingRangeViewModel({
      recent28: range({
        label: "Last 4 weeks",
        startDate: "2026-08-14",
        endDate: "2026-09-10",
        completed: 2,
        attempts: 20,
        successes: 15,
        accuracyPct: 75,
      }),
    });

    expect(model.ranges.recent28.accuracyPct).toBe(75);
    expect(model.ranges.recent28.attempts).toBe(20);
    expect(model.ranges.recent28.successes).toBe(15);
    expect(model.ranges.recent28.dateLabel).toBe("14 Aug–10 Sept");
  });
});
