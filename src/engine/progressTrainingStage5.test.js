import { describe, expect, it } from "vitest";
import {
  buildTrainingProgress,
  buildTrainingTrendSeries,
} from "./progressTrainingEngine.js";

function makeLog(
  date,
  {
    profileId = "profile-wilf",
    templateId = "session-a",
    completed = true,
    durationSec = 600,
    count = 0,
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
          id: `block-${date}-${templateId}`,
          typeId: "session",
          session: {
            templateId,
            displayCode: templateId === "session-a" ? "A" : "B",
            name: templateId === "session-a" ? "Close Control" : "First Touch",
            completed,
            actualDurationSec: durationSec,
            plannedDurationSec: 900,
            movements: [
              {
                movementId: "movement-1",
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

describe("Phase 3 Stage 5 rolling training trend", () => {
  it("splits the exact rolling 28-day window into four consecutive 7-day periods", () => {
    const series = buildTrainingTrendSeries([], {
      startDate: "2026-08-14",
      endDate: "2026-09-10",
    });

    expect(series.map((row) => [row.startDate, row.endDate])).toEqual([
      ["2026-08-14", "2026-08-20"],
      ["2026-08-21", "2026-08-27"],
      ["2026-08-28", "2026-09-03"],
      ["2026-09-04", "2026-09-10"],
    ]);
  });

  it("reconciles chart totals exactly to the locked recent28 summary", () => {
    const logs = [
      makeLog("2026-08-14", { count: 10, durationSec: 600 }),
      makeLog("2026-08-22", { count: 20, durationSec: 900 }),
      makeLog("2026-09-01", { count: 30, durationSec: 1200 }),
      makeLog("2026-09-10", { count: 40, durationSec: 300 }),
    ];

    const progress = buildTrainingProgress({
      logs,
      profileId: "profile-wilf",
      sessionTemplates: [],
      selectedDate: "2026-09-10",
    });

    expect(progress.trainingTrend).toHaveLength(4);
    expect(
      progress.trainingTrend.reduce((sum, row) => sum + row.completedSessions, 0)
    ).toBe(progress.recent28.completedSessions);
    expect(
      progress.trainingTrend.reduce((sum, row) => sum + row.totalMinutes, 0)
    ).toBe(progress.recent28.totalMinutes);
    expect(
      progress.trainingTrend.reduce((sum, row) => sum + row.recordedExecutions, 0)
    ).toBe(progress.recent28.recordedExecutions);
  });

  it("keeps out-of-range activity out while including both rolling-window endpoints", () => {
    const series = buildTrainingTrendSeries(
      [
        makeLog("2026-08-13"),
        makeLog("2026-08-14"),
        makeLog("2026-09-10"),
        makeLog("2026-09-11"),
      ],
      { startDate: "2026-08-14", endDate: "2026-09-10" }
    );

    expect(series.reduce((sum, row) => sum + row.completedSessions, 0)).toBe(2);
    expect(series[0].completedSessions).toBe(1);
    expect(series[3].completedSessions).toBe(1);
  });

  it("inherits profile isolation from the combined Progress model", () => {
    const progress = buildTrainingProgress({
      logs: [
        makeLog("2026-09-08", { profileId: "profile-wilf", count: 25 }),
        makeLog("2026-09-09", { profileId: "profile-xander", count: 99 }),
      ],
      profileId: "profile-wilf",
      selectedDate: "2026-09-10",
    });

    expect(progress.recent28.completedSessions).toBe(1);
    expect(
      progress.trainingTrend.reduce((sum, row) => sum + row.recordedExecutions, 0)
    ).toBe(25);
  });
});
