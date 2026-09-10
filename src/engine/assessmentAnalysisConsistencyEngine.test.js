import { describe, expect, it } from "vitest";
import {
  buildAnalysisSevenDayPeriods,
  buildBetweenAssessmentTrainingSummary,
  buildObservedTrainingConsistency,
  buildTrainingEvidenceSummary,
} from "./assessmentAnalysisConsistencyEngine.js";

function movement({ method = "completion", completed = true, result = null } = {}) {
  return {
    movementId: "m1",
    name: "Movement",
    trackingMethod: method,
    trackingConfig: {},
    completed,
    skipped: false,
    result,
  };
}

function sessionLog(date, {
  profileId = "wilf",
  completed = true,
  templateId = "session-a",
  code = "A",
  movementRow = movement(),
} = {}) {
  return {
    id: `${profileId}-${date}-${templateId}`,
    profile_id: profileId,
    date_ymd: date,
    log_json: {
      date_ymd: date,
      blocks: [{
        id: `block-${date}`,
        typeId: "session",
        session: {
          templateId,
          displayCode: code,
          name: `Session ${code}`,
          completed,
          actualDurationSec: completed ? 600 : 0,
          movements: [movementRow],
        },
      }],
    },
  };
}

function legacyLog(date, profileId = "wilf") {
  return {
    id: `legacy-${date}`,
    profile_id: profileId,
    date_ymd: date,
    log_json: { date_ymd: date, blocks: [{ typeId: "strength", exercises: [] }] },
  };
}

const interval28 = {
  valid: true,
  startDate: "2026-09-02",
  endDate: "2026-09-29",
  calendarDays: 28,
  excludesAssessmentDates: true,
};

describe("Phase 4 Stage 2 seven-day period construction", () => {
  it("splits a 28-day interval into four consecutive periods", () => {
    expect(buildAnalysisSevenDayPeriods(interval28)).toEqual([
      { index: 0, startDate: "2026-09-02", endDate: "2026-09-08", dayCount: 7 },
      { index: 1, startDate: "2026-09-09", endDate: "2026-09-15", dayCount: 7 },
      { index: 2, startDate: "2026-09-16", endDate: "2026-09-22", dayCount: 7 },
      { index: 3, startDate: "2026-09-23", endDate: "2026-09-29", dayCount: 7 },
    ]);
  });

  it("keeps a final partial period eligible rather than discarding it", () => {
    const periods = buildAnalysisSevenDayPeriods({
      valid: true,
      startDate: "2026-09-02",
      endDate: "2026-09-19",
    });
    expect(periods).toHaveLength(3);
    expect(periods[2]).toEqual({
      index: 2,
      startDate: "2026-09-16",
      endDate: "2026-09-19",
      dayCount: 4,
    });
  });
});

describe("Phase 4 Stage 2 observed structured-training consistency", () => {
  it("reports 100% when every eligible period contains a completed structured Session", () => {
    const consistency = buildObservedTrainingConsistency({
      logs: [
        sessionLog("2026-09-03"),
        sessionLog("2026-09-10"),
        sessionLog("2026-09-17"),
        sessionLog("2026-09-24"),
      ],
      profileId: "wilf",
      interval: interval28,
    });
    expect(consistency.kind).toBe("observed_structured_training_consistency");
    expect(consistency.isPlanAdherence).toBe(false);
    expect(consistency.eligiblePeriods).toBe(4);
    expect(consistency.activePeriods).toBe(4);
    expect(consistency.consistencyPct).toBe(100);
    expect(consistency.completedSessions).toBe(4);
  });

  it("reports 50% for activity in two of four periods", () => {
    const consistency = buildObservedTrainingConsistency({
      logs: [sessionLog("2026-09-03"), sessionLog("2026-09-17")],
      profileId: "wilf",
      interval: interval28,
    });
    expect(consistency.activePeriods).toBe(2);
    expect(consistency.consistencyPct).toBe(50);
  });

  it("counts a period once even when several Sessions occur inside it", () => {
    const consistency = buildObservedTrainingConsistency({
      logs: [sessionLog("2026-09-03"), sessionLog("2026-09-05", { templateId: "session-b", code: "B" })],
      profileId: "wilf",
      interval: interval28,
    });
    expect(consistency.activePeriods).toBe(1);
    expect(consistency.completedSessions).toBe(2);
  });

  it("does not make a period active from partial Sessions, legacy workouts or another athlete", () => {
    const consistency = buildObservedTrainingConsistency({
      logs: [
        sessionLog("2026-09-03", { completed: false }),
        legacyLog("2026-09-10"),
        sessionLog("2026-09-17", { profileId: "xander" }),
      ],
      profileId: "wilf",
      interval: interval28,
    });
    expect(consistency.activePeriods).toBe(0);
    expect(consistency.consistencyPct).toBe(0);
    expect(consistency.completedSessions).toBe(0);
  });

  it("returns null percentage when no valid interval exists", () => {
    const consistency = buildObservedTrainingConsistency({ interval: { valid: false } });
    expect(consistency.eligiblePeriods).toBe(0);
    expect(consistency.consistencyPct).toBeNull();
  });
});

describe("Phase 4 Stage 2 between-Assessment training summary", () => {
  it("keeps completed/partial Sessions and typed volume measures truthful", () => {
    const summary = buildBetweenAssessmentTrainingSummary({
      logs: [
        sessionLog("2026-09-03", {
          movementRow: movement({ method: "repetitions", result: { overall: { count: 25 } } }),
        }),
        sessionLog("2026-09-10", {
          templateId: "session-b",
          code: "B",
          movementRow: movement({
            method: "attempts_successes",
            result: { overall: { attempts: 10, successes: 7 } },
          }),
        }),
        sessionLog("2026-09-17", { completed: false }),
      ],
      profileId: "wilf",
      interval: interval28,
      sessionTemplates: [
        { id: "session-a", display_code: "A", name: "Session A", sort_order: 1 },
        { id: "session-b", display_code: "B", name: "Session B", sort_order: 2 },
      ],
    });
    expect(summary.completedSessions).toBe(2);
    expect(summary.partialSessions).toBe(1);
    expect(summary.totalMinutes).toBe(20);
    expect(summary.attempts).toBe(10);
    expect(summary.successes).toBe(7);
    expect(summary.accuracyPct).toBe(70);
  });
});

describe("Phase 4 Stage 2 incomplete-data evidence summaries", () => {
  it("describes high detail with executions without implying causation", () => {
    const summary = buildTrainingEvidenceSummary({
      evidenceLevel: "high",
      completedRelevantSessions: 7,
      recordedExecutions: 186,
    });
    expect(summary.sentence).toContain("7 completed related Sessions");
    expect(summary.sentence).toContain("186 recorded executions");
    expect(summary.sentence.toLowerCase()).not.toContain("caus");
    expect(summary.sentence.toLowerCase()).not.toContain("because");
  });

  it("describes attempts/successes as their own high-detail measure", () => {
    const summary = buildTrainingEvidenceSummary({
      evidenceLevel: "high",
      completedRelevantSessions: 4,
      attempts: 186,
      successes: 143,
    });
    expect(summary.sentence).toContain("143/186 successful attempts");
    expect(summary.sentence).not.toContain("recorded executions");
  });

  it("describes medium detail without inventing volume", () => {
    const summary = buildTrainingEvidenceSummary({
      evidenceLevel: "medium",
      completedRelevantSessions: 3,
    });
    expect(summary.sentence).toContain("3 completed related Sessions");
    expect(summary.sentence).toContain("detailed compatible volume was not recorded");
  });

  it("describes low detail as snapshot evidence, not completed training", () => {
    const summary = buildTrainingEvidenceSummary({
      evidenceLevel: "low",
      relatedSnapshotSessions: 2,
    });
    expect(summary.sentence).toContain("2 recorded Session snapshots");
    expect(summary.sentence).toContain("completion and volume evidence is incomplete");
    expect(summary.sentence).not.toContain("completed related Sessions");
  });

  it("describes no evidence as a recording limitation rather than proof of no training", () => {
    const summary = buildTrainingEvidenceSummary({ evidenceLevel: "none" });
    expect(summary.sentence).toContain("No related structured training was recorded");
    expect(summary.sentence).toContain("does not establish that no related training occurred");
  });

  it("surfaces current-taxonomy fallback provenance", () => {
    const summary = buildTrainingEvidenceSummary({
      evidenceLevel: "medium",
      completedRelevantSessions: 1,
      usedCurrentTaxonomyFallback: true,
    });
    expect(summary.taxonomyNote).toContain("current Development Tag taxonomy");
  });
});
