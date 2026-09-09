import {
  normaliseAssessmentMetricDefinition,
  normaliseAssessmentResult,
} from "../../engine/assessmentMetricEngine.js";
import {
  getTestDevelopmentTagIds,
  normaliseAssessmentLibrary,
  toEditorAssessmentTemplate,
  toEditorTemplateTest,
  toEditorTest,
} from "./assessmentLibraryController.js";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...value }
    : {};
}

function valueOf(obj, camelKey, snakeKey, fallback = undefined) {
  if (!obj || typeof obj !== "object") return fallback;
  if (obj[camelKey] !== undefined) return obj[camelKey];
  if (snakeKey && obj[snakeKey] !== undefined) return obj[snakeKey];
  return fallback;
}

function resultError(result, fallback) {
  if (!result?.error) return null;
  const message = result.error?.message || String(result.error);
  return new Error(`${fallback}: ${message}`);
}

async function expectRow(promise, fallback) {
  const result = await promise;
  const error = resultError(result, fallback);
  if (error) throw error;
  if (!result?.data) throw new Error(`${fallback}: no row returned`);
  return result.data;
}

function effectiveMetricDefinition(test, configOverride = {}) {
  const base = normaliseAssessmentMetricDefinition(test || {});
  const override = jsonObject(configOverride);
  const overrideMetricConfig = jsonObject(
    override.metricConfig ?? override.metric_config
  );

  return normaliseAssessmentMetricDefinition({
    metricType:
      override.metricType ?? override.metric_type ?? base.metricType,
    unit: override.unit ?? base.unit,
    scoringDirection:
      override.scoringDirection ??
      override.scoring_direction ??
      base.scoringDirection,
    attemptCount:
      override.attemptCount ?? override.attempt_count ?? base.attemptCount,
    resultStrategy:
      override.resultStrategy ??
      override.result_strategy ??
      base.resultStrategy,
    sideMode: override.sideMode ?? override.side_mode ?? base.sideMode,
    allowNegative:
      override.allowNegative ??
      override.allow_negative ??
      base.allowNegative,
    pbEligible:
      override.pbEligible ?? override.pb_eligible ?? base.pbEligible,
    metricConfig: {
      ...base.metricConfig,
      ...overrideMetricConfig,
    },
  });
}

export function buildAssessmentRunSnapshot(library, templateId) {
  const safe = normaliseAssessmentLibrary(library || {});
  const id = cleanText(templateId);
  const templateRow = safe.templates.find(
    (template) => cleanText(template.id) === id
  );

  if (!templateRow || templateRow.archived) {
    throw new Error("Choose an active Assessment before starting a run.");
  }

  const template = toEditorAssessmentTemplate(templateRow);
  const testsById = new Map(
    safe.tests.map((test) => [cleanText(test.id), test])
  );
  const rows = safe.templateTests
    .filter(
      (row) =>
        cleanText(
          valueOf(row, "assessmentTemplateId", "assessment_template_id")
        ) === id
    )
    .map(toEditorTemplateTest)
    .sort((a, b) => a.position - b.position);

  if (!rows.length) {
    throw new Error("This Assessment does not contain any Tests.");
  }

  const tests = rows.map((row, index) => {
    const testRow = testsById.get(cleanText(row.testId));
    if (!testRow || testRow.archived) {
      throw new Error(
        `Test ${index + 1} is unavailable. Update the Assessment definition before starting it.`
      );
    }

    const test = toEditorTest(testRow);
    const metric = effectiveMetricDefinition(test, row.configOverride);

    return {
      position: index + 1,
      assessmentTemplateTestId: row.id,
      testId: test.id,
      sectionLabel: row.sectionLabel,
      displayLabel: row.displayLabel || test.name,
      instructions: row.instructions,
      protocolText: row.protocolText,
      configOverride: jsonObject(row.configOverride),
      test: {
        id: test.id,
        name: test.name,
        description: test.description,
        version: test.version,
      },
      metric,
      developmentTagIds: getTestDevelopmentTagIds(safe, test.id),
    };
  });

  return {
    schemaVersion: 1,
    template: {
      id: template.id,
      name: template.name,
      category: template.category,
      description: template.description,
      version: template.version,
    },
    tests,
  };
}

export function getAssessmentRunSnapshot(run = {}) {
  const snapshot = valueOf(run, "templateSnapshot", "template_snapshot", {});
  return jsonObject(snapshot);
}

function emptyStoredResult(snapshotTest, assessmentRunId) {
  return {
    assessmentRunId,
    testId: snapshotTest.testId,
    assessmentTemplateTestId:
      snapshotTest.assessmentTemplateTestId || null,
    position: snapshotTest.position,
    sectionLabelSnapshot: snapshotTest.sectionLabel || "",
    testNameSnapshot:
      snapshotTest.displayLabel || snapshotTest.test?.name || "Test",
    metricSnapshot: jsonObject(snapshotTest.metric),
    resultData: {},
    retainedResult: {},
    comparableValue: null,
    comparableDimensions: {},
    isValid: false,
    notes: "",
  };
}

function retainedResultObject(evaluation) {
  if (!evaluation?.valid || evaluation.retainedResult === null) return {};
  if (evaluation.definition.sideMode === "separate") {
    return {
      left: evaluation.retainedResult?.left ?? null,
      right: evaluation.retainedResult?.right ?? null,
    };
  }
  return { overall: evaluation.retainedResult };
}

export function evaluateAssessmentTestResult(
  snapshotTest,
  resultData = {},
  notes = ""
) {
  const metric = normaliseAssessmentMetricDefinition(snapshotTest?.metric || {});
  const raw = jsonObject(resultData);
  const evaluation = normaliseAssessmentResult(metric, raw);

  return {
    valid: evaluation.valid,
    errors: evaluation.errors,
    displayValue: evaluation.displayValue,
    resultData: raw,
    retainedResult: retainedResultObject(evaluation),
    comparableValue: evaluation.comparableValue,
    comparableDimensions: jsonObject(evaluation.comparableDimensions),
    metricSnapshot: metric,
    notes: cleanText(notes, ""),
  };
}

export function assessmentRunDraftFromRows(run, results = []) {
  const snapshot = getAssessmentRunSnapshot(run);
  const rowsByPosition = new Map(
    (Array.isArray(results) ? results : []).map((row) => [
      Number(row?.position || 0),
      row,
    ])
  );
  const answers = {};

  for (const snapshotTest of Array.isArray(snapshot.tests)
    ? snapshot.tests
    : []) {
    const row = rowsByPosition.get(Number(snapshotTest.position)) || {};
    answers[String(snapshotTest.position)] = {
      resultData: jsonObject(
        valueOf(row, "resultData", "result_data", {})
      ),
      notes: cleanText(row.notes, ""),
    };
  }

  return {
    runNotes: cleanText(run?.notes, ""),
    answers,
  };
}

export async function startAssessmentRun({
  familyId,
  profileId,
  templateId,
  dateYmd,
  library,
  db,
  startedAt = new Date().toISOString(),
}) {
  if (!familyId) throw new Error("A family is required to start an Assessment.");
  if (!profileId) throw new Error("Choose an athlete before starting an Assessment.");
  if (!dateYmd) throw new Error("An Assessment date is required.");
  if (!db) throw new Error("An Assessment DB API is required.");

  const snapshot = buildAssessmentRunSnapshot(library, templateId);
  const run = await expectRow(
    db.createAssessmentRun(familyId, {
      profileId,
      assessmentTemplateId: snapshot.template.id,
      dateYmd,
      status: "in_progress",
      startedAt,
      templateVersion: snapshot.template.version,
      templateSnapshot: snapshot,
      notes: "",
    }),
    "Could not start Assessment"
  );

  const results = [];
  for (const snapshotTest of snapshot.tests) {
    results.push(
      await expectRow(
        db.createAssessmentTestResult(
          familyId,
          emptyStoredResult(snapshotTest, run.id)
        ),
        `Could not prepare Test ${snapshotTest.position}`
      )
    );
  }

  return { run, results, snapshot };
}

export async function ensureAssessmentRunResultRows({
  familyId,
  run,
  results = [],
  db,
}) {
  const snapshot = getAssessmentRunSnapshot(run);
  if (!snapshot?.template || !Array.isArray(snapshot.tests)) {
    throw new Error("This Assessment run does not contain a usable definition snapshot.");
  }

  const next = Array.isArray(results) ? results.slice() : [];
  const byPosition = new Map(
    next.map((row) => [Number(row?.position || 0), row])
  );

  if (cleanText(run?.status, "in_progress") !== "in_progress") {
    return next.sort((a, b) => Number(a.position) - Number(b.position));
  }

  for (const snapshotTest of snapshot.tests) {
    const position = Number(snapshotTest.position);
    const existing = byPosition.get(position);
    if (existing) {
      const existingTestId = cleanText(
        valueOf(existing, "testId", "test_id", "")
      );
      if (existingTestId && existingTestId !== cleanText(snapshotTest.testId)) {
        throw new Error(
          `Stored Test ${position} does not match the immutable run snapshot.`
        );
      }
      continue;
    }

    const created = await expectRow(
      db.createAssessmentTestResult(
        familyId,
        emptyStoredResult(snapshotTest, run.id)
      ),
      `Could not repair Test ${position}`
    );
    next.push(created);
    byPosition.set(position, created);
  }

  return next.sort((a, b) => Number(a.position) - Number(b.position));
}

export async function loadAssessmentRunState({
  familyId,
  runId,
  db,
}) {
  if (!familyId || !runId) throw new Error("Assessment run identity is required.");
  if (!db) throw new Error("An Assessment DB API is required.");

  const run = await expectRow(
    db.getAssessmentRun(familyId, runId),
    "Could not load Assessment run"
  );
  const result = await db.listAssessmentTestResults(familyId, {
    assessmentRunId: runId,
  });
  const error = resultError(result, "Could not load Assessment Test results");
  if (error) throw error;

  const results = await ensureAssessmentRunResultRows({
    familyId,
    run,
    results: result?.data || [],
    db,
  });

  return {
    run,
    results,
    snapshot: getAssessmentRunSnapshot(run),
    draft: assessmentRunDraftFromRows(run, results),
  };
}

export async function saveAssessmentRunProgress({
  familyId,
  run,
  results = [],
  answers = {},
  runNotes = "",
  db,
}) {
  if (!familyId || !run?.id) throw new Error("Assessment run identity is required.");
  if (!db) throw new Error("An Assessment DB API is required.");
  if (cleanText(run.status, "in_progress") !== "in_progress") {
    throw new Error("Only an in-progress Assessment can be edited.");
  }

  const snapshot = getAssessmentRunSnapshot(run);
  if (!Array.isArray(snapshot.tests) || !snapshot.tests.length) {
    throw new Error("The Assessment run snapshot does not contain Tests.");
  }

  const currentRows = await ensureAssessmentRunResultRows({
    familyId,
    run,
    results,
    db,
  });
  const rowByPosition = new Map(
    currentRows.map((row) => [Number(row?.position || 0), row])
  );
  const savedResults = [];
  const evaluations = [];

  for (const snapshotTest of snapshot.tests) {
    const key = String(snapshotTest.position);
    const answer = jsonObject(answers?.[key]);
    const existing = rowByPosition.get(Number(snapshotTest.position));
    const resultData = jsonObject(
      answer.resultData ??
        valueOf(existing, "resultData", "result_data", {})
    );
    const notes =
      answer.notes !== undefined
        ? cleanText(answer.notes, "")
        : cleanText(existing?.notes, "");
    const evaluation = evaluateAssessmentTestResult(
      snapshotTest,
      resultData,
      notes
    );

    evaluations.push({
      position: snapshotTest.position,
      testId: snapshotTest.testId,
      ...evaluation,
    });

    savedResults.push(
      await expectRow(
        db.updateAssessmentTestResult(existing.id, {
          resultData: evaluation.resultData,
          retainedResult: evaluation.retainedResult,
          comparableValue: evaluation.comparableValue,
          comparableDimensions: evaluation.comparableDimensions,
          isValid: evaluation.valid,
          notes: evaluation.notes,
        }),
        `Could not save Test ${snapshotTest.position}`
      )
    );
  }

  const savedRun = await expectRow(
    db.updateAssessmentRun(run.id, { notes: cleanText(runNotes, "") }),
    "Could not save Assessment notes"
  );

  return {
    run: savedRun,
    results: savedResults,
    evaluations,
    allValid: evaluations.every((item) => item.valid),
  };
}

export async function completeAssessmentRun({
  familyId,
  run,
  results = [],
  answers = {},
  runNotes = "",
  db,
  completedAt = new Date().toISOString(),
}) {
  const saved = await saveAssessmentRunProgress({
    familyId,
    run,
    results,
    answers,
    runNotes,
    db,
  });

  if (!saved.allValid) {
    const invalid = saved.evaluations
      .filter((item) => !item.valid)
      .map((item) => item.position);
    throw new Error(
      `Complete every Test with a valid result first. Check Test${invalid.length === 1 ? "" : "s"} ${invalid.join(", ")}.`
    );
  }

  const completedRun = await expectRow(
    db.updateAssessmentRun(run.id, {
      status: "completed",
      completedAt,
      notes: cleanText(runNotes, ""),
    }),
    "Could not complete Assessment"
  );

  return { ...saved, run: completedRun };
}

export async function cancelAssessmentRun({ run, db }) {
  if (!run?.id) throw new Error("Assessment run identity is required.");
  if (!db) throw new Error("An Assessment DB API is required.");
  if (cleanText(run.status, "in_progress") !== "in_progress") return run;

  return expectRow(
    db.updateAssessmentRun(run.id, { status: "cancelled" }),
    "Could not cancel Assessment"
  );
}
