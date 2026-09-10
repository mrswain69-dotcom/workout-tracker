import {
  getAttemptSuccessTotals,
  getBestScore,
  getRecordedExecutionTotal,
  movementWasPerformed,
  sessionIsCompleted,
} from "./sessionEngine.js";
import { buildAssessmentProgress } from "./progressAssessmentEngine.js";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function valueOf(obj, camelKey, snakeKey, fallback = undefined) {
  if (!obj || typeof obj !== "object") return fallback;
  if (obj[camelKey] !== undefined) return obj[camelKey];
  if (snakeKey && obj[snakeKey] !== undefined) return obj[snakeKey];
  return fallback;
}

function uniqueText(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => cleanText(value, ""))
        .filter(Boolean)
    )
  ).sort();
}

function isYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function toUtcDate(ymd) {
  if (!isYmd(ymd)) return null;
  const date = new Date(`${ymd}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function shiftYmd(ymd, days) {
  const date = toUtcDate(ymd);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function daysBetweenExclusive(previousDate, latestDate) {
  const previous = toUtcDate(previousDate);
  const latest = toUtcDate(latestDate);
  if (!previous || !latest || previous >= latest) return 0;
  return Math.max(0, Math.round((latest - previous) / 86400000) - 1);
}

function runIdOf(run) {
  return cleanText(run?.id, "");
}

function runProfileId(run) {
  return cleanText(valueOf(run, "profileId", "profile_id", ""), "");
}

function runTemplateId(run) {
  return cleanText(
    valueOf(run, "assessmentTemplateId", "assessment_template_id", ""),
    ""
  );
}

function runDate(run) {
  return cleanText(valueOf(run, "dateYmd", "date_ymd", ""), "");
}

function runCompletedAt(run) {
  return cleanText(valueOf(run, "completedAt", "completed_at", ""), "");
}

function runSnapshot(run) {
  const snapshot = valueOf(run, "templateSnapshot", "template_snapshot", {});
  return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
    ? snapshot
    : {};
}

function isCompletedRun(run) {
  return cleanText(run?.status, "").toLowerCase() === "completed";
}

function compareCompletedRunsDesc(a, b) {
  const dateCompare = runDate(b).localeCompare(runDate(a));
  if (dateCompare) return dateCompare;
  const completedCompare = runCompletedAt(b).localeCompare(runCompletedAt(a));
  if (completedCompare) return completedCompare;
  return runIdOf(b).localeCompare(runIdOf(a));
}

function resultRunId(row) {
  return cleanText(valueOf(row, "assessmentRunId", "assessment_run_id", ""), "");
}

function scopeResultsToRuns(results = [], runs = []) {
  const ids = new Set((Array.isArray(runs) ? runs : []).map(runIdOf).filter(Boolean));
  return (Array.isArray(results) ? results : []).filter((row) => ids.has(resultRunId(row)));
}

export function buildAssessmentAnalysisInterval(previousDate, latestDate) {
  if (!isYmd(previousDate) || !isYmd(latestDate) || previousDate >= latestDate) {
    return {
      valid: false,
      previousAssessmentDate: cleanText(previousDate, ""),
      latestAssessmentDate: cleanText(latestDate, ""),
      startDate: "",
      endDate: "",
      calendarDays: 0,
      excludesAssessmentDates: true,
    };
  }

  const startDate = shiftYmd(previousDate, 1);
  const endDate = shiftYmd(latestDate, -1);
  const calendarDays = daysBetweenExclusive(previousDate, latestDate);

  return {
    valid: calendarDays > 0 && startDate <= endDate,
    previousAssessmentDate: previousDate,
    latestAssessmentDate: latestDate,
    startDate: calendarDays > 0 ? startDate : "",
    endDate: calendarDays > 0 ? endDate : "",
    calendarDays,
    excludesAssessmentDates: true,
  };
}

export function buildAssessmentAnalysisPair({
  runs = [],
  results = [],
  profileId = "",
} = {}) {
  const targetProfile = cleanText(profileId, "");
  const completed = (Array.isArray(runs) ? runs : [])
    .filter(isCompletedRun)
    .filter((run) => !targetProfile || runProfileId(run) === targetProfile)
    .slice()
    .sort(compareCompletedRunsDesc);

  if (!completed.length) {
    return {
      state: "no_baseline",
      profileId: targetProfile,
      assessmentTemplateId: "",
      latestRun: null,
      previousRun: null,
      interval: buildAssessmentAnalysisInterval("", ""),
      assessmentProgress: buildAssessmentProgress({ profileId: targetProfile || null }),
    };
  }

  const latestRun = completed[0];
  const assessmentTemplateId = runTemplateId(latestRun);
  const sameTemplateRuns = completed.filter(
    (run) => runTemplateId(run) === assessmentTemplateId
  );
  const sameTemplateResults = scopeResultsToRuns(results, sameTemplateRuns);
  const assessmentProgress = buildAssessmentProgress({
    runs: sameTemplateRuns,
    results: sameTemplateResults,
    profileId: targetProfile || null,
    assessmentTemplateId: assessmentTemplateId || null,
  });
  const previousRun = sameTemplateRuns[1] || null;

  return {
    state: previousRun ? "analysis_ready" : "baseline_only",
    profileId: targetProfile,
    assessmentTemplateId,
    latestRun,
    previousRun,
    interval: buildAssessmentAnalysisInterval(
      previousRun ? runDate(previousRun) : "",
      runDate(latestRun)
    ),
    assessmentProgress,
  };
}

function relationMovementId(row) {
  return cleanText(valueOf(row, "movementId", "movement_id", ""), "");
}

function relationTestId(row) {
  return cleanText(valueOf(row, "testId", "test_id", ""), "");
}

function relationTagId(row) {
  return cleanText(
    valueOf(row, "developmentTagId", "development_tag_id", ""),
    ""
  );
}

function relationMap(rows = [], identityOf) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const identity = identityOf(row);
    const tagId = relationTagId(row);
    if (!identity || !tagId) continue;
    if (!map.has(identity)) map.set(identity, new Set());
    map.get(identity).add(tagId);
  }
  return map;
}

function hasOwn(obj, key) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function snapshotTestFor(run, testId) {
  const snapshot = runSnapshot(run);
  return (Array.isArray(snapshot.tests) ? snapshot.tests : []).find(
    (row) => cleanText(row?.testId, "") === cleanText(testId, "")
  ) || null;
}

export function resolveAnalysisTestDevelopmentTags(
  run,
  testId,
  testDevelopmentTags = []
) {
  const snapshotTest = snapshotTestFor(run, testId);
  if (snapshotTest && hasOwn(snapshotTest, "developmentTagIds")) {
    return {
      tagIds: uniqueText(snapshotTest.developmentTagIds),
      source: "frozen",
    };
  }

  const current = relationMap(testDevelopmentTags, relationTestId);
  const tagIds = uniqueText(Array.from(current.get(cleanText(testId, "")) || []));
  return {
    tagIds,
    source: tagIds.length ? "current_taxonomy" : "none",
  };
}

export function resolveAnalysisMovementDevelopmentTags(
  movement,
  movementDevelopmentTags = []
) {
  if (movement && hasOwn(movement, "developmentTagIds")) {
    return {
      tagIds: uniqueText(movement.developmentTagIds),
      source: "frozen",
    };
  }

  const movementId = cleanText(movement?.movementId, "");
  const current = relationMap(movementDevelopmentTags, relationMovementId);
  const tagIds = uniqueText(Array.from(current.get(movementId) || []));
  return {
    tagIds,
    source: tagIds.length ? "current_taxonomy" : "none",
  };
}

function intersects(a = [], bSet = new Set()) {
  return (Array.isArray(a) ? a : []).some((value) => bSet.has(value));
}

function logPayload(row) {
  return row?.log_json && typeof row.log_json === "object"
    ? row.log_json
    : row;
}

function logDate(row) {
  const payload = logPayload(row) || {};
  return cleanText(row?.date_ymd || payload?.date_ymd || payload?.date || payload?.ymd, "");
}

function logProfileId(row) {
  const payload = logPayload(row) || {};
  return cleanText(
    valueOf(row, "profileId", "profile_id", valueOf(payload, "profileId", "profile_id", "")),
    ""
  );
}

function dateInInterval(date, interval) {
  if (!interval?.valid || !isYmd(date)) return false;
  return date >= interval.startDate && date <= interval.endDate;
}

function sessionBlocks(row) {
  const payload = logPayload(row);
  const blocks = Array.isArray(payload?.blocks) ? payload.blocks : [];
  return blocks.filter(
    (block) => block?.typeId === "session" && block?.session && typeof block.session === "object"
  );
}

function sessionIdentity(session) {
  return cleanText(session?.templateId, "unknown");
}

function sessionName(session) {
  return cleanText(session?.name, "Session");
}

function sessionCode(session) {
  return cleanText(session?.displayCode, "");
}

function movementIdentity(movement) {
  return cleanText(movement?.movementId, movement?.name || movement?.displayLabel || "unknown");
}

function movementName(movement) {
  return cleanText(movement?.name || movement?.displayLabel, "Movement");
}

function classifyEvidenceLevel({ recordedExecutions, attempts, performedMovementCount, relatedSnapshotCount }) {
  if (recordedExecutions > 0 || attempts > 0) return "high";
  if (performedMovementCount > 0) return "medium";
  if (relatedSnapshotCount > 0) return "low";
  return "none";
}

export function buildRelevantTrainingEvidence({
  logs = [],
  profileId = "",
  interval = null,
  developmentTagIds = [],
  movementDevelopmentTags = [],
} = {}) {
  const targetTags = new Set(uniqueText(developmentTagIds));
  const targetProfile = cleanText(profileId, "");
  const byTemplate = new Map();
  const byMovement = new Map();
  const completedSessionKeys = new Set();
  const partialSessionKeys = new Set();
  const snapshotSessionKeys = new Set();
  let relatedSnapshotCount = 0;
  let performedMovementCount = 0;
  let recordedExecutions = 0;
  let attempts = 0;
  let successes = 0;
  let usedCurrentTaxonomyFallback = false;

  if (!interval?.valid || !targetTags.size) {
    return {
      interval,
      developmentTagIds: uniqueText(developmentTagIds),
      evidenceLevel: "none",
      relatedSnapshotCount: 0,
      completedRelevantSessions: 0,
      partialRelevantSessions: 0,
      performedMovementCount: 0,
      recordedExecutions: 0,
      attempts: 0,
      successes: 0,
      accuracyPct: null,
      sessionDistribution: [],
      movements: [],
      usedCurrentTaxonomyFallback: false,
    };
  }

  for (const row of Array.isArray(logs) ? logs : []) {
    if (targetProfile && logProfileId(row) !== targetProfile) continue;
    const date = logDate(row);
    if (!dateInInterval(date, interval)) continue;

    const blocks = sessionBlocks(row);
    blocks.forEach((block, blockIndex) => {
      const session = block.session;
      const movements = Array.isArray(session.movements) ? session.movements : [];
      const related = movements
        .map((movement) => ({
          movement,
          tags: resolveAnalysisMovementDevelopmentTags(movement, movementDevelopmentTags),
        }))
        .filter((entry) => intersects(entry.tags.tagIds, targetTags));

      if (!related.length) return;

      const sessionKey = `${date}|${cleanText(block?.id, String(blockIndex))}|${sessionIdentity(session)}`;
      snapshotSessionKeys.add(sessionKey);
      relatedSnapshotCount += related.length;

      let hasPerformedRelatedMovement = false;
      for (const entry of related) {
        const { movement, tags } = entry;
        if (tags.source === "current_taxonomy") usedCurrentTaxonomyFallback = true;
        if (!movementWasPerformed(movement)) continue;

        hasPerformedRelatedMovement = true;
        performedMovementCount += 1;
        const executions = getRecordedExecutionTotal(movement);
        const attemptTotals = getAttemptSuccessTotals(movement);
        const bestScore = getBestScore(movement);
        recordedExecutions += executions;
        attempts += attemptTotals.attempts;
        successes += attemptTotals.successes;

        const movementId = movementIdentity(movement);
        if (!byMovement.has(movementId)) {
          byMovement.set(movementId, {
            movementId,
            name: movementName(movement),
            timesPerformed: 0,
            recordedExecutions: 0,
            attempts: 0,
            successes: 0,
            bestScore: null,
            lastPerformedDate: "",
            tagSources: new Set(),
          });
        }
        const movementRow = byMovement.get(movementId);
        movementRow.timesPerformed += 1;
        movementRow.recordedExecutions += executions;
        movementRow.attempts += attemptTotals.attempts;
        movementRow.successes += attemptTotals.successes;
        movementRow.tagSources.add(tags.source);
        if (bestScore !== null && (movementRow.bestScore === null || bestScore > movementRow.bestScore)) {
          movementRow.bestScore = bestScore;
        }
        if (!movementRow.lastPerformedDate || date > movementRow.lastPerformedDate) {
          movementRow.lastPerformedDate = date;
        }
      }

      if (!hasPerformedRelatedMovement) return;

      if (sessionIsCompleted(session)) {
        completedSessionKeys.add(sessionKey);
        const templateId = sessionIdentity(session);
        if (!byTemplate.has(templateId)) {
          byTemplate.set(templateId, {
            templateId,
            displayCode: sessionCode(session),
            name: sessionName(session),
            count: 0,
            lastCompletedDate: "",
          });
        }
        const templateRow = byTemplate.get(templateId);
        templateRow.count += 1;
        if (!templateRow.lastCompletedDate || date > templateRow.lastCompletedDate) {
          templateRow.lastCompletedDate = date;
        }
      } else {
        partialSessionKeys.add(sessionKey);
      }
    });
  }

  const movementRows = Array.from(byMovement.values())
    .map((row) => ({
      ...row,
      accuracyPct:
        row.attempts > 0 ? Math.round((row.successes / row.attempts) * 1000) / 10 : null,
      tagSources: Array.from(row.tagSources).sort(),
    }))
    .sort((a, b) => b.timesPerformed - a.timesPerformed || a.name.localeCompare(b.name));

  const sessionDistribution = Array.from(byTemplate.values()).sort(
    (a, b) =>
      (a.displayCode || a.name).localeCompare(b.displayCode || b.name) ||
      a.name.localeCompare(b.name)
  );

  return {
    interval,
    developmentTagIds: uniqueText(developmentTagIds),
    evidenceLevel: classifyEvidenceLevel({
      recordedExecutions,
      attempts,
      performedMovementCount,
      relatedSnapshotCount,
    }),
    relatedSnapshotCount,
    relatedSnapshotSessions: snapshotSessionKeys.size,
    completedRelevantSessions: completedSessionKeys.size,
    partialRelevantSessions: partialSessionKeys.size,
    performedMovementCount,
    recordedExecutions,
    attempts,
    successes,
    accuracyPct: attempts > 0 ? Math.round((successes / attempts) * 1000) / 10 : null,
    sessionDistribution,
    movements: movementRows,
    usedCurrentTaxonomyFallback,
  };
}

export function buildAssessmentTrainingEvidence({
  runs = [],
  results = [],
  logs = [],
  profileId = "",
  sessionLibrary = {},
  assessmentLibrary = {},
} = {}) {
  const pair = buildAssessmentAnalysisPair({ runs, results, profileId });
  if (pair.state !== "analysis_ready") {
    return {
      ...pair,
      tests: [],
    };
  }

  const testDevelopmentTags = Array.isArray(assessmentLibrary.testDevelopmentTags)
    ? assessmentLibrary.testDevelopmentTags
    : Array.isArray(assessmentLibrary.test_development_tags)
    ? assessmentLibrary.test_development_tags
    : [];
  const movementDevelopmentTags = Array.isArray(sessionLibrary.movementDevelopmentTags)
    ? sessionLibrary.movementDevelopmentTags
    : Array.isArray(sessionLibrary.movement_development_tags)
    ? sessionLibrary.movement_development_tags
    : [];

  const tests = pair.assessmentProgress.latestTestStatuses.map((status) => {
    const tags = resolveAnalysisTestDevelopmentTags(
      pair.latestRun,
      status.testId,
      testDevelopmentTags
    );
    const training = buildRelevantTrainingEvidence({
      logs,
      profileId,
      interval: pair.interval,
      developmentTagIds: tags.tagIds,
      movementDevelopmentTags,
    });

    return {
      testId: status.testId,
      testName: status.testName,
      status: status.status,
      dimensions: status.dimensions,
      latest: status.latest,
      previous: status.previous,
      baseline: status.baseline,
      pb: status.pb,
      percentageRank: status.percentageRank,
      metric: status.metric,
      metricChanged: status.metricChanged,
      comparisonAvailable: status.comparisonAvailable,
      developmentTagIds: tags.tagIds,
      developmentTagSource: tags.source,
      training,
    };
  });

  return {
    ...pair,
    tests,
  };
}
