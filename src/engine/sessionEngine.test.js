import { describe, expect, it } from "vitest";
import {
  aggregateMovementHistory,
  aggregateSessionHistory,
  buildSessionSnapshot,
  getAttemptSuccessTotals,
  getBestScore,
  getRecommendedNextSession,
  getSessionDistribution,
  movementHasRecordedResult,
  movementWasPerformed,
  normaliseMovementResult,
  sessionHasActivity,
  sessionIsCompleted,
} from "./sessionEngine.js";

function makeLibrary() {
  return {
    programmes: [
      {
        id: "programme-football",
        name: "Football Skills",
      },
    ],
    movements: [
      {
        id: "movement-sole-rolls",
        name: "Sole Rolls",
      },
      {
        id: "movement-first-touch",
        name: "First Touch Through Gate",
      },
      {
        id: "movement-keepy-ups",
        name: "Weak-Foot Keepy-Uppys",
      },
    ],
    templates: [
      {
        id: "session-a",
        family_id: "family-1",
        programme_id: "programme-football",
        display_code: "A",
        name: "Close Control",
        planned_duration_sec: 900,
        version: 1,
        sort_order: 1,
        archived: false,
      },
      {
        id: "session-b",
        family_id: "family-1",
        programme_id: "programme-football",
        display_code: "B",
        name: "First Touch & Protection",
        planned_duration_sec: 900,
        version: 1,
        sort_order: 2,
        archived: false,
      },
      {
        id: "session-c",
        family_id: "family-1",
        programme_id: "programme-football",
        display_code: "C",
        name: "Direction & Weak Foot",
        planned_duration_sec: 900,
        version: 1,
        sort_order: 3,
        archived: false,
      },
    ],
    templateMovements: [
      {
        id: "a-sole-rolls",
        session_template_id: "session-a",
        movement_id: "movement-sole-rolls",
        position: 1,
        display_label: "Sole Rolls",
        planned_duration_sec: 150,
        tracking_method: "repetitions",
        tracking_config: {
          countLabel: "clean reps",
          quickSteps: [1, 5, 10],
        },
      },
      {
        id: "b-first-touch",
        session_template_id: "session-b",
        movement_id: "movement-first-touch",
        position: 1,
        display_label: "First Touch Through Gate",
        planned_duration_sec: 150,
        tracking_method: "attempts_successes",
        tracking_config: {
          sideMode: "separate",
        },
      },
      {
        id: "c-keepy-ups",
        session_template_id: "session-c",
        movement_id: "movement-keepy-ups",
        position: 1,
        display_label: "Weak-Foot Keepy-Uppys",
        planned_duration_sec: 300,
        tracking_method: "best_score",
        tracking_config: {},
      },
      {
        id: "c-sole-rolls-reuse",
        session_template_id: "session-c",
        movement_id: "movement-sole-rolls",
        position: 2,
        display_label: "Sole Rolls at Speed",
        planned_duration_sec: 150,
        tracking_method: "repetitions",
        tracking_config: {
          countLabel: "clean reps",
        },
      },
    ],
  };
}

function makeLog(date, session) {
  return {
    date_ymd: date,
    log_json: {
      date_ymd: date,
      blocks: [
        {
          id: `block-${date}-${session.templateId}`,
          typeId: "session",
          session,
        },
      ],
    },
  };
}

function snapshotFor(templateId, library = makeLibrary()) {
  const snapshot = buildSessionSnapshot(templateId, library);
  if (!snapshot) throw new Error(`Snapshot not built for ${templateId}`);
  return snapshot;
}

describe("buildSessionSnapshot", () => {
  it("builds a self-contained immutable historical definition", () => {
    const library = makeLibrary();
    const snapshot = snapshotFor("session-a", library);

    expect(snapshot.templateId).toBe("session-a");
    expect(snapshot.templateVersion).toBe(1);
    expect(snapshot.displayCode).toBe("A");
    expect(snapshot.name).toBe("Close Control");
    expect(snapshot.movements).toHaveLength(1);
    expect(snapshot.movements[0].movementId).toBe("movement-sole-rolls");
    expect(snapshot.movements[0].trackingMethod).toBe("repetitions");
    expect(snapshot.movements[0].trackingConfig.required).toBe(false);

    // Simulate a later edit to the live template/library definition.
    library.templates[0].name = "Changed Session Name";
    library.templates[0].version = 2;
    library.templateMovements[0].display_label = "Changed Movement Label";
    library.templateMovements[0].tracking_config.quickSteps.push(50);

    expect(snapshot.name).toBe("Close Control");
    expect(snapshot.templateVersion).toBe(1);
    expect(snapshot.movements[0].displayLabel).toBe("Sole Rolls");
    expect(snapshot.movements[0].trackingConfig.quickSteps).toEqual([1, 5, 10]);
  });
});

describe("movement result normalisation", () => {
  it("normalises left/right attempts and successes independently", () => {
    const result = normaliseMovementResult(
      "attempts_successes",
      {
        left: { attempts: "10", successes: "8" },
        right: { attempts: 10, successes: 6 },
      },
      { sideMode: "separate" }
    );

    expect(result).toEqual({
      left: { attempts: 10, successes: 8 },
      right: { attempts: 10, successes: 6 },
    });
  });

  it("treats zero as a valid recorded result", () => {
    const movement = {
      trackingMethod: "attempts_successes",
      trackingConfig: {},
      completed: true,
      skipped: false,
      result: {
        overall: { attempts: 10, successes: 0 },
      },
    };

    expect(movementHasRecordedResult(movement)).toBe(true);
    expect(getAttemptSuccessTotals(movement)).toEqual({
      attempts: 10,
      successes: 0,
    });
  });
});

describe("Session completion versus detailed tracking", () => {
  it("allows a completed Session with no numeric movement result", () => {
    const session = snapshotFor("session-a");
    session.completed = true;
    session.movements[0].completed = true;
    session.movements[0].result = null;

    expect(sessionIsCompleted(session)).toBe(true);
    expect(sessionHasActivity(session)).toBe(true);
    expect(movementWasPerformed(session.movements[0])).toBe(true);
    expect(movementHasRecordedResult(session.movements[0])).toBe(false);
  });

  it("keeps a partial Session incomplete while retaining movement activity", () => {
    const session = snapshotFor("session-a");
    session.movements[0].result = {
      overall: { count: 36 },
    };

    expect(sessionIsCompleted(session)).toBe(false);
    expect(sessionHasActivity(session)).toBe(true);
    expect(movementWasPerformed(session.movements[0])).toBe(true);

    const history = aggregateSessionHistory([
      makeLog("2026-09-01", session),
    ]);

    expect(history.completedSessions).toBe(0);
    expect(history.partialSessions).toBe(1);
    expect(history.recordedExecutions).toBe(36);
  });
});

describe("structured performance totals", () => {
  it("aggregates left/right attempts and successes", () => {
    const session = snapshotFor("session-b");
    session.completed = true;
    session.movements[0].completed = true;
    session.movements[0].result = {
      left: { attempts: 10, successes: 8 },
      right: { attempts: 10, successes: 6 },
    };

    expect(getAttemptSuccessTotals(session)).toEqual({
      attempts: 20,
      successes: 14,
    });

    const history = aggregateSessionHistory([
      makeLog("2026-09-02", session),
    ]);

    expect(history.attempts).toBe(20);
    expect(history.successes).toBe(14);
    expect(history.accuracyPct).toBe(70);
  });

  it("returns the best score from a Session", () => {
    const session = snapshotFor("session-c");
    session.movements[0].completed = true;
    session.movements[0].result = {
      overall: { best: 24 },
    };

    expect(getBestScore(session)).toBe(24);
  });
});

describe("canonical movement history", () => {
  it("combines the same movement across different Session templates", () => {
    const library = makeLibrary();
    const sessionA = snapshotFor("session-a", library);
    const sessionC = snapshotFor("session-c", library);

    sessionA.completed = true;
    sessionA.movements[0].completed = true;
    sessionA.movements[0].result = { overall: { count: 30 } };

    sessionC.completed = true;
    const reusedSoleRolls = sessionC.movements.find(
      (movement) => movement.movementId === "movement-sole-rolls"
    );
    reusedSoleRolls.completed = true;
    reusedSoleRolls.result = { overall: { count: 20 } };

    const movementHistory = aggregateMovementHistory([
      makeLog("2026-09-01", sessionA),
      makeLog("2026-09-03", sessionC),
    ]);

    const soleRolls = movementHistory.find(
      (row) => row.movementId === "movement-sole-rolls"
    );

    expect(soleRolls.timesPerformed).toBe(2);
    expect(soleRolls.recordedExecutions).toBe(50);
    expect(soleRolls.lastPerformedDate).toBe("2026-09-03");
  });
});

describe("Session balance and recommendation", () => {
  it("counts only completed Sessions in distribution", () => {
    const library = makeLibrary();
    const a1 = snapshotFor("session-a", library);
    const a2 = snapshotFor("session-a", library);
    const b1 = snapshotFor("session-b", library);
    const partialC = snapshotFor("session-c", library);

    a1.completed = true;
    a2.completed = true;
    b1.completed = true;
    partialC.movements[0].result = { overall: { best: 12 } };

    const logs = [
      makeLog("2026-09-01", a1),
      makeLog("2026-09-03", a2),
      makeLog("2026-09-04", b1),
      makeLog("2026-09-05", partialC),
    ];

    const distribution = getSessionDistribution(logs, {
      startDate: "2026-09-01",
      endDate: "2026-09-08",
    });

    expect(distribution.find((row) => row.templateId === "session-a")?.count).toBe(2);
    expect(distribution.find((row) => row.templateId === "session-b")?.count).toBe(1);
    expect(distribution.find((row) => row.templateId === "session-c")).toBeUndefined();
  });

  it("recommends the least-completed active Session in the recent window", () => {
    const library = makeLibrary();
    const logs = [];

    for (const date of ["2026-08-20", "2026-08-24", "2026-08-28", "2026-09-01"]) {
      const session = snapshotFor("session-a", library);
      session.completed = true;
      logs.push(makeLog(date, session));
    }

    for (const date of ["2026-08-22", "2026-08-30", "2026-09-03"]) {
      const session = snapshotFor("session-b", library);
      session.completed = true;
      logs.push(makeLog(date, session));
    }

    const c = snapshotFor("session-c", library);
    c.completed = true;
    logs.push(makeLog("2026-08-25", c));

    const recommendation = getRecommendedNextSession({
      templates: library.templates,
      logs,
      days: 28,
      endDate: "2026-09-08",
    });

    expect(recommendation.templateId).toBe("session-c");
    expect(recommendation.completedInWindow).toBe(1);
    expect(recommendation.startDate).toBe("2026-08-12");
    expect(recommendation.endDate).toBe("2026-09-08");
  });

  it("uses template order as the stable tie-break when no Session has history", () => {
    const library = makeLibrary();
    const recommendation = getRecommendedNextSession({
      templates: library.templates,
      logs: [],
      days: 28,
      endDate: "2026-09-08",
    });

    expect(recommendation.templateId).toBe("session-a");
    expect(recommendation.completedInWindow).toBe(0);
  });
});
