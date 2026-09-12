import { describe, expect, it } from "vitest";
import { buildHistoricalTimelineEvents } from "./historicalTimelineEventEngine.js";
import {
  buildHistoricalAgeChapters,
  buildHistoricalTrendEvidence,
} from "./historicalAgeChapterEngine.js";
import { ageChapterDateRange } from "./historicalAgeEngine.js";

function strengthLog({ id, profileId = "p1", date, reps, movementId = "squat", name = "Squat" }) {
  return {
    id,
    profile_id: profileId,
    date_ymd: date,
    log_json: {
      blocks: [
        {
          id: `${id}-strength`,
          typeId: "strength",
          movements: [{ id: movementId, name }],
          sets: {
            [movementId]: [{ reps: String(reps), weight: "0", timeSeconds: "" }],
          },
        },
      ],
    },
  };
}

function cardioLog({ id, profileId = "p1", date, distanceKm = 5, durationMin }) {
  const speed = distanceKm / (durationMin / 60);
  return {
    id,
    profile_id: profileId,
    date_ymd: date,
    log_json: {
      blocks: [
        {
          id: `${id}-cardio`,
          typeId: "cardio",
          cardioType: "run",
          label: "Run",
          cardio: {
            distanceKm: String(distanceKm),
            durationMin: String(durationMin),
            avgSpeedKmh: String(speed),
          },
        },
      ],
    },
  };
}

describe("historicalAgeChapterEngine", () => {
  it("builds exact birthday-to-birthday age chapter ranges", () => {
    expect(ageChapterDateRange("2014-12-15", 11)).toEqual({
      age: 11,
      startDate: "2025-12-15",
      endDate: "2026-12-14",
    });
    expect(ageChapterDateRange("2012-02-29", 13)).toEqual({
      age: 13,
      startDate: "2025-03-01",
      endDate: "2026-02-28",
    });
  });

  it("fails closed into date-based unassigned history when birth date is unavailable", () => {
    const logs = [strengthLog({ id: "l1", date: "2026-06-01", reps: 10 })];
    const events = buildHistoricalTimelineEvents({ logs, profileId: "p1" });
    const model = buildHistoricalAgeChapters({
      events,
      workoutLogs: logs,
      profileId: "p1",
      birthDate: null,
    });

    expect(model.available).toBe(false);
    expect(model.reason).toBe("birth_date_required");
    expect(model.chapters).toEqual([]);
    expect(model.unassignedEvents).toHaveLength(1);
    expect(model.trendEvidence.strength.state).toBe("ready");
  });

  it("partitions evidence by attained age and preserves chapter coverage", () => {
    const logs = [
      strengthLog({ id: "before", date: "2026-12-14", reps: 10 }),
      strengthLog({ id: "birthday", date: "2026-12-15", reps: 12 }),
    ];
    const events = buildHistoricalTimelineEvents({
      logs,
      profileId: "p1",
      birthDate: "2014-12-15",
    });
    const model = buildHistoricalAgeChapters({
      events,
      workoutLogs: logs,
      profileId: "p1",
      birthDate: "2014-12-15",
    });

    expect(model.chapters.map((chapter) => chapter.age)).toEqual([11, 12]);
    expect(model.chapters[0]).toMatchObject({
      label: "Age 11",
      startDate: "2025-12-15",
      endDate: "2026-12-14",
      firstEvidenceDate: "2026-12-14",
      lastEvidenceDate: "2026-12-14",
      trainingDays: 1,
    });
    expect(model.chapters[1].firstEvidenceDate).toBe("2026-12-15");
  });

  it("reuses canonical improvement observations for metric-specific strength and cardio trends", () => {
    const logs = [
      strengthLog({ id: "s1", date: "2026-01-01", reps: 10, name: "Goblet Squat" }),
      strengthLog({ id: "s2", date: "2026-01-08", reps: 12, name: "Goblet Squat" }),
      cardioLog({ id: "c1", date: "2026-01-02", durationMin: 30 }),
      cardioLog({ id: "c2", date: "2026-01-09", durationMin: 25 }),
    ];
    const events = buildHistoricalTimelineEvents({ logs, profileId: "p1", birthDate: "2014-12-15" });
    const evidence = buildHistoricalTrendEvidence({
      events,
      workoutLogs: logs,
      profileId: "p1",
      birthDate: "2014-12-15",
    });

    expect(evidence.strength.state).toBe("ready");
    expect(evidence.strength.series).toHaveLength(1);
    expect(evidence.strength.series[0]).toMatchObject({
      label: "Goblet Squat",
      metricLabel: "Best set reps",
      unit: "reps",
    });
    expect(evidence.strength.series[0].points.map((point) => point.value)).toEqual([10, 12]);

    expect(evidence.cardio.state).toBe("ready");
    expect(evidence.cardio.series).toHaveLength(1);
    expect(evidence.cardio.series[0].points.map((point) => point.value)).toEqual([10, 12]);

    const improvements = evidence.improvementHighlights.filter(
      (highlight) => highlight.kind === "record_improvement"
    );
    expect(improvements).toHaveLength(2);
    expect(improvements.map((highlight) => highlight.percentageImprovement)).toEqual([20, 20]);
  });

  it("distinguishes recorded legacy evidence from genuinely comparable trend evidence", () => {
    const logs = [
      {
        id: "legacy",
        profile_id: "p1",
        date_ymd: "2025-12-30",
        log_json: { entries: { oldMove: [{ reps: "8" }] } },
      },
    ];
    const events = buildHistoricalTimelineEvents({ logs, profileId: "p1", birthDate: "2014-12-15" });
    const model = buildHistoricalAgeChapters({
      events,
      workoutLogs: logs,
      profileId: "p1",
      birthDate: "2014-12-15",
    });

    expect(model.chapters).toHaveLength(1);
    expect(model.chapters[0].strength).toMatchObject({
      state: "recorded_only",
      recordedCount: 1,
      series: [],
    });
  });

  it("never mixes another athlete's raw performance into the selected athlete chapter", () => {
    const logs = [
      strengthLog({ id: "own", profileId: "p1", date: "2026-01-01", reps: 10 }),
      strengthLog({ id: "other", profileId: "p2", date: "2026-01-01", reps: 50, name: "Other Squat" }),
    ];
    const events = buildHistoricalTimelineEvents({ logs, profileId: "p1", birthDate: "2014-12-15" });
    const model = buildHistoricalAgeChapters({
      events,
      workoutLogs: logs,
      profileId: "p1",
      birthDate: "2014-12-15",
    });

    expect(model.chapters).toHaveLength(1);
    expect(model.chapters[0].strength.series[0].points).toHaveLength(1);
    expect(model.chapters[0].strength.series[0].points[0].value).toBe(10);
  });

  it("keeps knowledge deliberately unavailable until a genuine history source exists", () => {
    const logs = [strengthLog({ id: "l1", date: "2026-01-01", reps: 10 })];
    const events = buildHistoricalTimelineEvents({ logs, profileId: "p1", birthDate: "2014-12-15" });
    const model = buildHistoricalAgeChapters({
      events,
      workoutLogs: logs,
      profileId: "p1",
      birthDate: "2014-12-15",
    });

    expect(model.chapters[0].knowledge).toEqual({
      state: "not_available_yet",
      milestones: [],
    });
  });
});
