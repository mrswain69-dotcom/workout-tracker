import { describe, expect, it } from "vitest";
import {
  buildLifetimeTrainingTrendSeries,
  buildTrainingRangeViews,
} from "./progressTrainingRangeEngine.js";

function sessionTemplate(id, code, name) {
  return { id, display_code: code, name, sort_order: code === "A" ? 1 : 2 };
}

function makeLog(
  date,
  {
    profileId = "wilf",
    templateId = "session-a",
    code = "A",
    name = "Close Control",
    completed = true,
    count = 10,
    durationSec = 600,
  } = {}
) {
  return {
    id: `${profileId}-${date}-${templateId}`,
    profile_id: profileId,
    date_ymd: date,
    log_json: {
      date_ymd: date,
      blocks: [
        {
          typeId: "session",
          session: {
            templateId,
            displayCode: code,
            name,
            completed,
            actualDurationSec: durationSec,
            plannedDurationSec: 900,
            movements: [
              {
                movementId: "sole-rolls",
                name: "Sole Rolls",
                trackingMethod: "repetitions",
                completed: count > 0,
                result: count > 0 ? { overall: { count } } : null,
              },
            ],
          },
        },
      ],
    },
  };
}

function legacyLog(date, profileId = "wilf") {
  return {
    id: `legacy-${date}`,
    profile_id: profileId,
    date_ymd: date,
    log_json: {
      date_ymd: date,
      blocks: [{ typeId: "strength", movements: [] }],
    },
  };
}

const templates = [
  sessionTemplate("session-a", "A", "Close Control"),
  sessionTemplate("session-b", "B", "First Touch"),
];

describe("Phase 3 Stage 7 training range engine", () => {
  it("keeps Last 4 weeks, This month and All time on explicit independent windows", () => {
    const views = buildTrainingRangeViews({
      logs: [
        makeLog("2026-07-05", { templateId: "session-b", code: "B", name: "First Touch", count: 30 }),
        makeLog("2026-09-02", { count: 20 }),
        makeLog("2026-09-09", { count: 40 }),
      ],
      profileId: "wilf",
      sessionTemplates: templates,
      selectedDate: "2026-09-10",
    });

    expect(views.recent28.summary.completedSessions).toBe(2);
    expect(views.month.summary.completedSessions).toBe(2);
    expect(views.lifetime.summary.completedSessions).toBe(3);
    expect(views.recent28.startDate).toBe("2026-08-14");
    expect(views.month.startDate).toBe("2026-09-01");
    expect(views.month.endDate).toBe("2026-09-30");
    expect(views.month.trend.at(-1).endDate).toBe("2026-09-10");
    expect(views.lifetime.startDate).toBe("");
  });

  it("changes Session distribution with the selected range without reclassifying old workouts", () => {
    const views = buildTrainingRangeViews({
      logs: [
        legacyLog("2026-06-01"),
        makeLog("2026-07-05", { templateId: "session-b", code: "B", name: "First Touch" }),
        makeLog("2026-09-09", { templateId: "session-a", code: "A", name: "Close Control" }),
      ],
      profileId: "wilf",
      sessionTemplates: templates,
      selectedDate: "2026-09-10",
    });

    const recent = Object.fromEntries(views.recent28.sessionBalance.map((row) => [row.displayCode, row.count]));
    const lifetime = Object.fromEntries(views.lifetime.sessionBalance.map((row) => [row.displayCode, row.count]));
    expect(recent).toEqual({ A: 1, B: 0 });
    expect(lifetime).toEqual({ A: 1, B: 1 });
    expect(views.lifetime.summary.completedSessions).toBe(2);
  });

  it("scopes Movement totals to the selected range", () => {
    const views = buildTrainingRangeViews({
      logs: [
        makeLog("2026-07-05", { count: 30 }),
        makeLog("2026-09-09", { count: 40 }),
      ],
      profileId: "wilf",
      sessionTemplates: templates,
      selectedDate: "2026-09-10",
    });

    expect(views.recent28.movementTotals[0].recordedExecutions).toBe(40);
    expect(views.lifetime.movementTotals[0].recordedExecutions).toBe(70);
  });

  it("builds All-time chart buckets from structured activity months only", () => {
    const series = buildLifetimeTrainingTrendSeries([
      legacyLog("2026-05-02"),
      makeLog("2026-07-05", { count: 30 }),
      legacyLog("2026-08-03"),
      makeLog("2026-09-09", { count: 40 }),
    ]);

    expect(series.map((row) => row.monthKey)).toEqual(["2026-07", "2026-09"]);
    expect(series.map((row) => row.completedSessions)).toEqual([1, 1]);
  });

  it("inherits profile isolation across every range", () => {
    const views = buildTrainingRangeViews({
      logs: [
        makeLog("2026-09-09", { profileId: "wilf", count: 40 }),
        makeLog("2026-09-09", { profileId: "xander", count: 99 }),
      ],
      profileId: "wilf",
      sessionTemplates: templates,
      selectedDate: "2026-09-10",
    });

    expect(views.recent28.summary.recordedExecutions).toBe(40);
    expect(views.month.summary.recordedExecutions).toBe(40);
    expect(views.lifetime.summary.recordedExecutions).toBe(40);
  });
});
