import { describe, expect, it, vi } from "vitest";
import {
  assessmentRunDraftFromRows,
  buildAssessmentRunSnapshot,
  cancelAssessmentRun,
  completeAssessmentRun,
  ensureAssessmentRunResultRows,
  evaluateAssessmentTestResult,
  loadAssessmentRunState,
  saveAssessmentRunProgress,
  startAssessmentRun,
} from "./assessmentRunController.js";

function libraryFixture() {
  return {
    templates: [
      {
        id: "a1",
        family_id: "f1",
        name: "Monthly Benchmark",
        category: "Football",
        description: "Benchmark",
        version: 3,
        sort_order: 1,
        archived: false,
      },
    ],
    tests: [
      {
        id: "t1",
        family_id: "f1",
        name: "10 m acceleration",
        description: "Standing start",
        version: 2,
        metric_type: "time",
        unit: "s",
        scoring_direction: "lower",
        attempt_count: 3,
        result_strategy: "best",
        side_mode: "none",
        allow_negative: false,
        pb_eligible: true,
        metric_config: { decimalPlaces: 2 },
      },
      {
        id: "t2",
        family_id: "f1",
        name: "Single leg raise",
        description: "Controlled reps",
        version: 1,
        metric_type: "repetitions",
        unit: "reps",
        scoring_direction: "higher",
        attempt_count: 1,
        result_strategy: "single",
        side_mode: "separate",
        allow_negative: false,
        pb_eligible: true,
        metric_config: {},
      },
    ],
    templateTests: [
      {
        id: "r1",
        assessment_template_id: "a1",
        test_id: "t1",
        position: 1,
        section_label: "Athletic",
        display_label: "10m Sprint",
        instructions: "Three efforts",
        protocol_text: "Best of three",
        config_override: { attemptCount: 2 },
      },
      {
        id: "r2",
        assessment_template_id: "a1",
        test_id: "t2",
        position: 2,
        section_label: "Athletic",
        display_label: "Calf raises",
        instructions: "Full range",
        protocol_text: "One set each side",
        config_override: {},
      },
    ],
    developmentTags: [{ id: "tag-speed", name: "Speed" }],
    testDevelopmentTags: [
      { test_id: "t1", development_tag_id: "tag-speed" },
    ],
  };
}

function snapshotRun(snapshot, patch = {}) {
  return {
    id: "run-1",
    family_id: "f1",
    profile_id: "p1",
    assessment_template_id: "a1",
    date_ymd: "2026-09-09",
    status: "in_progress",
    template_version: 3,
    template_snapshot: snapshot,
    notes: "",
    ...patch,
  };
}

function resultRow(position, testId, patch = {}) {
  return {
    id: `result-${position}`,
    family_id: "f1",
    assessment_run_id: "run-1",
    test_id: testId,
    position,
    result_data: {},
    retained_result: {},
    comparable_value: null,
    comparable_dimensions: {},
    is_valid: false,
    notes: "",
    ...patch,
  };
}

function dbMock(snapshot) {
  const run = snapshotRun(snapshot);
  const rows = [resultRow(1, "t1"), resultRow(2, "t2")];
  return {
    createAssessmentRun: vi.fn(async (_family, payload) => ({
      data: { ...run, started_at: payload.startedAt, template_snapshot: payload.templateSnapshot },
      error: null,
    })),
    createAssessmentTestResult: vi.fn(async (_family, payload) => ({
      data: {
        id: `created-${payload.position}`,
        family_id: "f1",
        assessment_run_id: payload.assessmentRunId,
        test_id: payload.testId,
        position: payload.position,
        result_data: payload.resultData,
        retained_result: payload.retainedResult,
        comparable_value: payload.comparableValue,
        comparable_dimensions: payload.comparableDimensions,
        is_valid: payload.isValid,
        notes: payload.notes,
      },
      error: null,
    })),
    getAssessmentRun: vi.fn(async () => ({ data: run, error: null })),
    listAssessmentTestResults: vi.fn(async () => ({ data: rows, error: null })),
    updateAssessmentTestResult: vi.fn(async (id, patch) => ({
      data: { ...rows.find((row) => row.id === id), ...patch, id },
      error: null,
    })),
    updateAssessmentRun: vi.fn(async (_id, patch) => ({
      data: {
        ...run,
        ...patch,
        completed_at: patch.completedAt ?? run.completed_at,
        template_snapshot: snapshot,
      },
      error: null,
    })),
  };
}

describe("Assessment run snapshot", () => {
  it("freezes Template identity, ordered rows, canonical Test identity and effective metrics", () => {
    const snapshot = buildAssessmentRunSnapshot(libraryFixture(), "a1");
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.template).toEqual(
      expect.objectContaining({ id: "a1", name: "Monthly Benchmark", version: 3 })
    );
    expect(snapshot.tests.map((test) => test.testId)).toEqual(["t1", "t2"]);
    expect(snapshot.tests[0]).toEqual(
      expect.objectContaining({
        assessmentTemplateTestId: "r1",
        position: 1,
        sectionLabel: "Athletic",
        displayLabel: "10m Sprint",
        developmentTagIds: ["tag-speed"],
      })
    );
    expect(snapshot.tests[0].test).toEqual(
      expect.objectContaining({ name: "10 m acceleration", version: 2 })
    );
    expect(snapshot.tests[0].metric).toEqual(
      expect.objectContaining({ attemptCount: 2, scoringDirection: "lower", resultStrategy: "best" })
    );
  });

  it("does not change after the live library is edited", () => {
    const library = libraryFixture();
    const snapshot = buildAssessmentRunSnapshot(library, "a1");
    library.templates[0].name = "Renamed later";
    library.tests[0].name = "Changed Test later";
    library.tests[0].attempt_count = 9;
    library.templateTests.reverse();

    expect(snapshot.template.name).toBe("Monthly Benchmark");
    expect(snapshot.tests[0].test.name).toBe("10 m acceleration");
    expect(snapshot.tests[0].metric.attemptCount).toBe(2);
    expect(snapshot.tests.map((item) => item.testId)).toEqual(["t1", "t2"]);
  });

  it("rejects an Assessment with an unavailable canonical Test", () => {
    const library = libraryFixture();
    library.tests = library.tests.filter((test) => test.id !== "t2");
    expect(() => buildAssessmentRunSnapshot(library, "a1")).toThrow(/Test 2 is unavailable/);
  });
});

describe("Assessment result evaluation", () => {
  it("uses the Stage 2 lower-is-better best-of-N engine and stores retained data as an object", () => {
    const test = buildAssessmentRunSnapshot(libraryFixture(), "a1").tests[0];
    const result = evaluateAssessmentTestResult(test, {
      overall: { attempts: [2.11, 2.03] },
    });
    expect(result.valid).toBe(true);
    expect(result.displayValue).toBe("2.03 s");
    expect(result.retainedResult).toEqual({ overall: 2.03 });
    expect(result.comparableValue).toBe(2.03);
    expect(result.comparableDimensions).toEqual({ overall: 2.03 });
  });

  it("preserves separate left/right retained results and comparable dimensions", () => {
    const test = buildAssessmentRunSnapshot(libraryFixture(), "a1").tests[1];
    const result = evaluateAssessmentTestResult(test, {
      left: { attempts: [18] },
      right: { attempts: [21] },
    });
    expect(result.valid).toBe(true);
    expect(result.retainedResult).toEqual({ left: 18, right: 21 });
    expect(result.comparableValue).toBeNull();
    expect(result.comparableDimensions).toEqual({ left: 18, right: 21 });
  });
});

describe("Assessment run persistence", () => {
  it("creates the run snapshot before creating placeholder Test rows", async () => {
    const snapshot = buildAssessmentRunSnapshot(libraryFixture(), "a1");
    const db = dbMock(snapshot);
    const started = await startAssessmentRun({
      familyId: "f1",
      profileId: "p1",
      templateId: "a1",
      dateYmd: "2026-09-09",
      library: libraryFixture(),
      db,
      startedAt: "2026-09-09T18:00:00.000Z",
    });

    expect(db.createAssessmentRun).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({
        profileId: "p1",
        assessmentTemplateId: "a1",
        templateVersion: 3,
        templateSnapshot: expect.objectContaining({ schemaVersion: 1 }),
      })
    );
    expect(db.createAssessmentTestResult).toHaveBeenCalledTimes(2);
    expect(started.results[0].is_valid).toBe(false);
  });

  it("repairs a missing placeholder only while the run is in progress", async () => {
    const snapshot = buildAssessmentRunSnapshot(libraryFixture(), "a1");
    const db = dbMock(snapshot);
    const run = snapshotRun(snapshot);
    const rows = await ensureAssessmentRunResultRows({
      familyId: "f1",
      run,
      results: [resultRow(1, "t1")],
      db,
    });
    expect(db.createAssessmentTestResult).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(2);

    db.createAssessmentTestResult.mockClear();
    await ensureAssessmentRunResultRows({
      familyId: "f1",
      run: { ...run, status: "completed" },
      results: [resultRow(1, "t1")],
      db,
    });
    expect(db.createAssessmentTestResult).not.toHaveBeenCalled();
  });

  it("loads a run from its stored snapshot rather than refreshing live definitions", async () => {
    const snapshot = buildAssessmentRunSnapshot(libraryFixture(), "a1");
    const db = dbMock(snapshot);
    const loaded = await loadAssessmentRunState({ familyId: "f1", runId: "run-1", db });
    expect(loaded.snapshot.template.name).toBe("Monthly Benchmark");
    expect(loaded.draft.answers["1"].resultData).toEqual({});
    expect(db.getAssessmentRun).toHaveBeenCalledWith("f1", "run-1");
  });

  it("saves valid and partial Test data without completing the run", async () => {
    const snapshot = buildAssessmentRunSnapshot(libraryFixture(), "a1");
    const db = dbMock(snapshot);
    const run = snapshotRun(snapshot);
    const saved = await saveAssessmentRunProgress({
      familyId: "f1",
      run,
      results: [resultRow(1, "t1"), resultRow(2, "t2")],
      answers: {
        "1": { resultData: { overall: { attempts: [2.1, 2.02] } } },
        "2": { resultData: { left: { attempts: [18] }, right: { attempts: [""] } } },
      },
      runNotes: "Wet surface",
      db,
    });

    expect(saved.allValid).toBe(false);
    expect(db.updateAssessmentTestResult).toHaveBeenCalledTimes(2);
    expect(db.updateAssessmentRun).toHaveBeenCalledWith("run-1", { notes: "Wet surface" });
    expect(db.updateAssessmentRun).not.toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "completed" })
    );
  });

  it("refuses completion until every Test is valid and leaves status in progress", async () => {
    const snapshot = buildAssessmentRunSnapshot(libraryFixture(), "a1");
    const db = dbMock(snapshot);
    const run = snapshotRun(snapshot);
    await expect(
      completeAssessmentRun({
        familyId: "f1",
        run,
        results: [resultRow(1, "t1"), resultRow(2, "t2")],
        answers: {
          "1": { resultData: { overall: { attempts: [2.1, 2.0] } } },
          "2": { resultData: { left: { attempts: [18] }, right: { attempts: [""] } } },
        },
        db,
      })
    ).rejects.toThrow(/Complete every Test/);
    expect(db.updateAssessmentRun).not.toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "completed" })
    );
  });

  it("marks the run complete only after all Test rows save successfully", async () => {
    const snapshot = buildAssessmentRunSnapshot(libraryFixture(), "a1");
    const db = dbMock(snapshot);
    const run = snapshotRun(snapshot);
    const completed = await completeAssessmentRun({
      familyId: "f1",
      run,
      results: [resultRow(1, "t1"), resultRow(2, "t2")],
      answers: {
        "1": { resultData: { overall: { attempts: [2.1, 2.0] } } },
        "2": { resultData: { left: { attempts: [18] }, right: { attempts: [21] } } },
      },
      db,
      completedAt: "2026-09-09T18:30:00.000Z",
    });
    expect(completed.allValid).toBe(true);
    expect(db.updateAssessmentRun).toHaveBeenLastCalledWith(
      "run-1",
      expect.objectContaining({
        status: "completed",
        completedAt: "2026-09-09T18:30:00.000Z",
      })
    );
  });

  it("cancels by status update and never deletes history", async () => {
    const snapshot = buildAssessmentRunSnapshot(libraryFixture(), "a1");
    const db = dbMock(snapshot);
    await cancelAssessmentRun({ run: snapshotRun(snapshot), db });
    expect(db.updateAssessmentRun).toHaveBeenCalledWith("run-1", { status: "cancelled" });
    expect(db.deleteAssessmentRun).toBeUndefined();
  });

  it("restores saved draft result data and notes for resume", () => {
    const snapshot = buildAssessmentRunSnapshot(libraryFixture(), "a1");
    const draft = assessmentRunDraftFromRows(snapshotRun(snapshot, { notes: "Overall" }), [
      resultRow(1, "t1", { result_data: { overall: { attempts: [2.03] } }, notes: "Fast" }),
      resultRow(2, "t2"),
    ]);
    expect(draft.runNotes).toBe("Overall");
    expect(draft.answers["1"]).toEqual({
      resultData: { overall: { attempts: [2.03] } },
      notes: "Fast",
    });
  });
});
