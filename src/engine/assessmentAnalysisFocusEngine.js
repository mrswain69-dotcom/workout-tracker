import {
  buildSessionBalance,
  scopeProgressLogs,
} from "./progressTrainingEngine.js";
import { resolveAnalysisTestDevelopmentTags } from "./assessmentAnalysisEvidenceEngine.js";

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
  return Array.from(new Set((Array.isArray(values) ? values : []).map((v) => cleanText(v, "")).filter(Boolean))).sort();
}

function activeTemplate(template) {
  return template?.archived !== true && template?.active !== false;
}

function templateId(row) {
  return cleanText(row?.id || valueOf(row, "sessionTemplateId", "session_template_id", ""), "");
}

function templateDisplayCode(row) {
  return cleanText(valueOf(row, "displayCode", "display_code", ""), "");
}

function templateSortOrder(row) {
  const value = Number(valueOf(row, "sortOrder", "sort_order", Number.MAX_SAFE_INTEGER));
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function templateMovementTemplateId(row) {
  return cleanText(valueOf(row, "sessionTemplateId", "session_template_id", ""), "");
}

function templateMovementMovementId(row) {
  return cleanText(valueOf(row, "movementId", "movement_id", ""), "");
}

function movementRelationMovementId(row) {
  return cleanText(valueOf(row, "movementId", "movement_id", ""), "");
}

function developmentTagId(row) {
  return cleanText(valueOf(row, "developmentTagId", "development_tag_id", ""), "");
}

function testRelationTestId(row) {
  return cleanText(valueOf(row, "testId", "test_id", ""), "");
}

function latestSnapshotTests(latestRun) {
  const snapshot = valueOf(latestRun, "templateSnapshot", "template_snapshot", {});
  return Array.isArray(snapshot?.tests) ? snapshot.tests : [];
}

export function collectAssessmentDevelopmentTagIds({
  latestRun = null,
  assessmentProgress = null,
  testDevelopmentTags = [],
} = {}) {
  if (!latestRun) return [];
  const testIds = new Set();
  for (const test of latestSnapshotTests(latestRun)) {
    const id = cleanText(valueOf(test, "testId", "test_id", ""), "");
    if (id) testIds.add(id);
  }
  for (const status of assessmentProgress?.latestTestStatuses || []) {
    const id = cleanText(status?.testId, "");
    if (id) testIds.add(id);
  }

  const tags = [];
  for (const testId of testIds) {
    tags.push(...resolveAnalysisTestDevelopmentTags(latestRun, testId, testDevelopmentTags).tagIds);
  }
  return uniqueText(tags);
}

export function buildRelevantActiveSessionTemplates({
  sessionLibrary = {},
  developmentTagIds = [],
} = {}) {
  const targetTags = new Set(uniqueText(developmentTagIds));
  if (!targetTags.size) return [];

  const templates = Array.isArray(sessionLibrary.templates) ? sessionLibrary.templates : [];
  const templateMovements = Array.isArray(sessionLibrary.templateMovements)
    ? sessionLibrary.templateMovements
    : Array.isArray(sessionLibrary.sessionTemplateMovements)
    ? sessionLibrary.sessionTemplateMovements
    : [];
  const movementDevelopmentTags = Array.isArray(sessionLibrary.movementDevelopmentTags)
    ? sessionLibrary.movementDevelopmentTags
    : Array.isArray(sessionLibrary.movement_development_tags)
    ? sessionLibrary.movement_development_tags
    : [];

  const tagsByMovement = new Map();
  for (const relation of movementDevelopmentTags) {
    const movementId = movementRelationMovementId(relation);
    const tagId = developmentTagId(relation);
    if (!movementId || !tagId) continue;
    if (!tagsByMovement.has(movementId)) tagsByMovement.set(movementId, new Set());
    tagsByMovement.get(movementId).add(tagId);
  }

  const movementIdsByTemplate = new Map();
  for (const row of templateMovements) {
    const currentTemplateId = templateMovementTemplateId(row);
    const movementId = templateMovementMovementId(row);
    if (!currentTemplateId || !movementId) continue;
    if (!movementIdsByTemplate.has(currentTemplateId)) movementIdsByTemplate.set(currentTemplateId, new Set());
    movementIdsByTemplate.get(currentTemplateId).add(movementId);
  }

  return templates
    .filter(activeTemplate)
    .filter((template) => {
      const ids = movementIdsByTemplate.get(templateId(template)) || new Set();
      for (const movementId of ids) {
        const tags = tagsByMovement.get(movementId) || new Set();
        for (const tagId of tags) {
          if (targetTags.has(tagId)) return true;
        }
      }
      return false;
    })
    .slice()
    .sort((a, b) =>
      templateSortOrder(a) - templateSortOrder(b) ||
      templateDisplayCode(a).localeCompare(templateDisplayCode(b)) ||
      cleanText(a?.name, "").localeCompare(cleanText(b?.name, "")) ||
      templateId(a).localeCompare(templateId(b))
    );
}

export function buildRelevantSessionBalance({
  logs = [],
  profileId = "",
  interval = null,
  sessionLibrary = {},
  developmentTagIds = [],
} = {}) {
  const relevantTemplates = buildRelevantActiveSessionTemplates({ sessionLibrary, developmentTagIds });
  if (!relevantTemplates.length) return [];
  const scopedLogs = scopeProgressLogs(logs, profileId);
  const raw = buildSessionBalance(scopedLogs, relevantTemplates, {
    startDate: interval?.valid ? interval.startDate : "",
    endDate: interval?.valid ? interval.endDate : "",
  });
  const counts = new Map(raw.map((row) => [cleanText(row.templateId, ""), Number(row.count) || 0]));
  const maxCount = relevantTemplates.reduce((max, template) => Math.max(max, counts.get(templateId(template)) || 0), 0);
  const minCount = relevantTemplates.reduce((min, template) => Math.min(min, counts.get(templateId(template)) || 0), Number.POSITIVE_INFINITY);
  const hasImbalance = relevantTemplates.length > 1 && minCount < maxCount;

  return relevantTemplates.map((template) => {
    const id = templateId(template);
    const count = counts.get(id) || 0;
    return {
      templateId: id,
      displayCode: templateDisplayCode(template),
      name: cleanText(template?.name, "Session"),
      sortOrder: templateSortOrder(template),
      completedCount: count,
      underrepresented: hasImbalance && count < maxCount,
      lowestCount: hasImbalance && count === minCount,
    };
  });
}

export function buildPossibleNextFocus(sessionBalance = []) {
  const rows = Array.isArray(sessionBalance) ? sessionBalance : [];
  const candidates = rows
    .filter((row) => row?.lowestCount && row?.underrepresented)
    .slice()
    .sort((a, b) =>
      (Number(a.sortOrder) || Number.MAX_SAFE_INTEGER) - (Number(b.sortOrder) || Number.MAX_SAFE_INTEGER) ||
      cleanText(a.displayCode, "").localeCompare(cleanText(b.displayCode, "")) ||
      cleanText(a.name, "").localeCompare(cleanText(b.name, "")) ||
      cleanText(a.templateId, "").localeCompare(cleanText(b.templateId, ""))
    );
  const selected = candidates[0];
  if (!selected) {
    return {
      available: false,
      templateId: "",
      displayCode: "",
      name: "",
      reason: "",
      basis: "session_balance_only",
    };
  }

  const label = selected.displayCode
    ? `Session ${selected.displayCode} · ${selected.name}`
    : selected.name;
  return {
    available: true,
    templateId: selected.templateId,
    displayCode: selected.displayCode,
    name: selected.name,
    reason: `${label} was completed less often than at least one other related active Session between benchmarks.`,
    basis: "session_balance_only",
  };
}

export function buildAssessmentSessionFocus({
  latestRun = null,
  assessmentProgress = null,
  assessmentLibrary = {},
  sessionLibrary = {},
  logs = [],
  profileId = "",
  interval = null,
} = {}) {
  const testDevelopmentTags = Array.isArray(assessmentLibrary.testDevelopmentTags)
    ? assessmentLibrary.testDevelopmentTags
    : [];
  const developmentTagIds = collectAssessmentDevelopmentTagIds({
    latestRun,
    assessmentProgress,
    testDevelopmentTags,
  });
  const sessionBalance = buildRelevantSessionBalance({
    logs,
    profileId,
    interval,
    sessionLibrary,
    developmentTagIds,
  });
  return {
    developmentTagIds,
    sessionBalance,
    possibleNextFocus: buildPossibleNextFocus(sessionBalance),
  };
}
