import { describe, expect, it } from "vitest";
import {
  buildCareerSummaryFoundation,
  buildConsistencyMilestoneEvents,
  buildKnowledgeMilestoneEvents,
  composeHistoricalMilestones,
} from "./historicalMilestoneEngine.js";

function durationLog(date, blockId = "planned") {
  return {
    profile_id: "p1",
    date_ymd: date,
    log: {
      blocks: [
        {
          id: blockId,
          typeId: "duration",
          loggedAt: `${date}T17:00:00.000Z`,
          duration: { minutes: 20 },
        },
      ],
    },
  };
}

function trainingEvent(date, id = date) {
  return {
    id: `workout:${id}:training_day:${date}`,
    profileId: "p1",
    date,
    age: null,
    sourceType: "workout",
    sourceId: id,
    eventType: "training_day",
    title: "Training recorded",
    evidence: {},
    evidenceState: "recorded",
  };
}

function scheduleSnapshot(effectiveDate, weekdays = ["Mon", "Wed"]) {
  const schedule = {
    Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [],
  };
  for (const weekday of weekdays) {
    schedule[weekday] = [{ id: "planned", typeId: "duration" }];
  }
  return {
    profile_id: "p1",
    effective_date: effectiveDate,
    schedule_json: schedule,
  };
}

describe("Historical Timeline Stage 4 milestone engine", () => {
  it("creates only historically supported 90/95/100 consistency milestones", () => {
    const result = buildConsistencyMilestoneEvents({
      profileId: "p1",
      birthDate: "2012-06-15",
      referenceDate: "2026-01-11",
      consistencySnapshots: [scheduleSnapshot("2026-01-05")],
      logs: [durationLog("2026-01-05"), durationLog("2026-01-07")],
    });

    expect(result.state).toBe("ready");
    expect(result.scoredWeeks).toHaveLength(1);
    expect(result.scoredWeeks[0].plannedDays).toBe(2);
    expect(result.scoredWeeks[0].completedDays).toBe(2);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      sourceType: "consistency",
      eventType: "consistency_week",
      title: "Perfect consistency week",
      date: "2026-01-11",
      age: 13,
      evidenceState: "derived_from_authoritative_schedule",
    });
    expect(result.events[0].evidence.consistencyPct).toBe(100);
  });

  it("does not project a schedule backwards before its effective date", () => {
    const result = buildConsistencyMilestoneEvents({
      profileId: "p1",
      referenceDate: "2026-01-11",
      consistencySnapshots: [scheduleSnapshot("2026-01-07")],
      logs: [durationLog("2026-01-05"), durationLog("2026-01-07")],
    });

    expect(result.scoredWeeks).toHaveLength(0);
    expect(result.events).toHaveLength(0);
    expect(result.state).toBe("insufficient_supported_history");
  });

  it("keeps Knowledge unavailable until a real source explicitly opts in", () => {
    const milestone = {
      id: "knowledge-1",
      profile_id: "p1",
      date_ymd: "2026-02-01",
      event_type: "knowledge_level_reached",
      title: "Knowledge Level 5",
      evidence: { level: 5 },
    };

    expect(
      buildKnowledgeMilestoneEvents([milestone], {
        profileId: "p1",
        sourceAvailable: false,
      })
    ).toEqual({ state: "not_available_yet", events: [] });

    const enabled = buildKnowledgeMilestoneEvents([milestone], {
      profileId: "p1",
      birthDate: "2012-06-15",
      sourceAvailable: true,
    });
    expect(enabled.state).toBe("ready");
    expect(enabled.events[0]).toMatchObject({
      sourceType: "knowledge",
      eventType: "knowledge_level_reached",
      title: "Knowledge Level 5",
      age: 13,
    });
  });

  it("composes base, Consistency and future Knowledge events deterministically", () => {
    const result = composeHistoricalMilestones({
      profileId: "p1",
      events: [trainingEvent("2026-01-06")],
      referenceDate: "2026-01-11",
      consistencySnapshots: [scheduleSnapshot("2026-01-05")],
      logs: [durationLog("2026-01-05"), durationLog("2026-01-07")],
      knowledgeSourceAvailable: true,
      knowledgeMilestones: [
        {
          id: "k1",
          profile_id: "p1",
          date_ymd: "2026-01-08",
          event_type: "knowledge_module_completed",
          title: "Recovery module completed",
        },
      ],
    });

    expect(result.events.map((event) => event.sourceType)).toEqual([
      "workout",
      "knowledge",
      "consistency",
    ]);
  });

  it("keeps Career Summary locked until the evidence span reaches three full calendar years", () => {
    const locked = buildCareerSummaryFoundation({
      profileId: "p1",
      events: [trainingEvent("2023-01-01", "a"), trainingEvent("2025-12-31", "b")],
    });
    expect(locked.available).toBe(false);
    expect(locked.reason).toBe("three_year_history_required");
    expect(locked.gate.unlockDate).toBe("2026-01-01");

    const unlocked = buildCareerSummaryFoundation({
      profileId: "p1",
      events: [trainingEvent("2023-01-01", "a"), trainingEvent("2026-01-01", "b")],
    });
    expect(unlocked.available).toBe(true);
    expect(unlocked.reason).toBeNull();
    expect(unlocked.training.recordedTrainingDays).toBe(2);
    expect(unlocked.improvement.lifetime.universalPercentage).toBeNull();
    expect(unlocked.improvement.lifetime.state).toBe("metric_specific_only");
  });

  it("uses the canonical badge streak engine and preserves frozen season award distinctions", () => {
    const events = [
      trainingEvent("2023-01-01", "first"),
      trainingEvent("2026-01-01", "d1"),
      trainingEvent("2026-01-02", "d2"),
      trainingEvent("2026-01-03", "d3"),
      {
        id: "group_award:season-win",
        profileId: "p1",
        date: "2025-12-31",
        sourceType: "group_award",
        sourceId: "season-win",
        eventType: "season_award",
        title: "Season Improvement Champion",
        evidence: { awardType: "season_improvement" },
        evidenceState: "recorded",
      },
      {
        id: "group_award:season-finisher",
        profileId: "p1",
        date: "2025-12-31",
        sourceType: "group_award",
        sourceId: "season-finisher",
        eventType: "season_award",
        title: "Season Finisher",
        evidence: { awardType: "season_finisher" },
        evidenceState: "recorded",
      },
    ];
    const workoutLogs = [
      durationLog("2026-01-01"),
      durationLog("2026-01-02"),
      durationLog("2026-01-03"),
    ];

    const summary = buildCareerSummaryFoundation({
      profileId: "p1",
      events,
      workoutLogs,
    });

    expect(summary.available).toBe(true);
    expect(summary.streak).toEqual({
      highestWorkoutStreakDays: 3,
      authority: "badgeStatsV2",
    });
    expect(summary.awards).toMatchObject({
      totalFrozenAwards: 2,
      seasonAwards: 2,
      seasonWins: 1,
      seasonFinishers: 1,
    });
  });

  it("clamps leap-day three-year unlocks without inventing an extra day", () => {
    const summary = buildCareerSummaryFoundation({
      profileId: "p1",
      events: [trainingEvent("2024-02-29", "a"), trainingEvent("2027-02-28", "b")],
    });
    expect(summary.gate.unlockDate).toBe("2027-02-28");
    expect(summary.available).toBe(true);
  });
});
