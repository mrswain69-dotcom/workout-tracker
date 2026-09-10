import {
  aggregateMovementHistory,
  aggregateSessionHistory,
  getSessionDistribution,
  sessionHasActivity,
  sessionIsCompleted,
} from "./sessionEngine.js";

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

function isYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function toUtcDate(ymd) {
  if (!isYmd(ymd)) return null;
  const date = new Date(`${ymd}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function fromUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

export function shiftProgressYmd(ymd, days) {
  const date = toUtcDate(ymd);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return fromUtcDate(date);
}

function monthStartYmd(ymd) {
  const date = toUtcDate(ymd);
  if (!date) return "";
  date.setUTCDate(1);
  return fromUtcDate(date);
}

function monthEndYmd(ymd) {
  const date = toUtcDate(ymd);
  if (!date) return "";
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return fromUtcDate(date);
}

export function mondayWeekStartYmd(ymd) {
  const date = toUtcDate(ymd);
  if (!date) return "";
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return fromUtcDate(date);
}

export function buildTrainingProgressWindows(selectedDate) {
  const referenceDate = isYmd(selectedDate)
    ? String(selectedDate)
    : new Date().toISOString().slice(0, 10);
  const weekStart = mondayWeekStartYmd(referenceDate);
  const weekEnd = shiftProgressYmd(weekStart, 6);

  return {
    referenceDate,
    week: {
      startDate: weekStart,
      endDate: weekEnd,
      label: "This week",
    },
    month: {
      startDate: monthStartYmd(referenceDate),
      endDate: monthEndYmd(referenceDate),
      label: "This month",
    },
    recent28: {
      startDate: shiftProgressYmd(referenceDate, -27),
      endDate: referenceDate,
      label: "Last 4 weeks",
      days: 28,
    },
    lifetime: {
      startDate: "",
      endDate: "",
      label: "All time",
    },
  };
}

function rowProfileId(row) {
  return cleanText(
    valueOf(row, "profileId", "profile_id", valueOf(row?.log_json, "profileId", "profile_id", "")),
    ""
  );
}

export function scopeProgressLogs(logs = [], profileId = "") {
  const source = Array.isArray(logs) ? logs : [];
  const target = cleanText(profileId, "");
  if (!target) return source.slice();
  return source.filter((row) => rowProfileId(row) === target);
}

function rowDate(row) {
  const payload = row?.log_json && typeof row.log_json === "object"
    ? row.log_json
    : row;
  return cleanText(row?.date_ymd || payload?.date_ymd || payload?.date || payload?.ymd, "");
}

function dateInRange(date, startDate, endDate) {
  if (!date) return false;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

function sessionBlocks(row) {
  const payload = row?.log_json && typeof row.log_json === "object"
    ? row.log_json
    : row;
  const blocks = Array.isArray(payload?.blocks) ? payload.blocks : [];
  return blocks.filter(
    (block) => block?.typeId === "session" && block?.session && typeof block.session === "object"
  );
}

export function countStructuredSessionDays(
  logs = [],
  { startDate = "", endDate = "", completedOnly = false } = {}
) {
  const dates = new Set();
  for (const row of Array.isArray(logs) ? logs : []) {
    const date = rowDate(row);
    if (!dateInRange(date, startDate, endDate)) continue;
    const qualifies = sessionBlocks(row).some((block) =>
      completedOnly ? sessionIsCompleted(block.session) : sessionHasActivity(block.session)
    );
    if (qualifies) dates.add(date);
  }
  return dates.size;
}

export function buildTrainingWindowSummary(
  logs = [],
  { startDate = "", endDate = "", label = "" } = {}
) {
  const history = aggregateSessionHistory(logs, { startDate, endDate });
  return {
    label,
    startDate,
    endDate,
    completedSessions: history.completedSessions,
    partialSessions: history.partialSessions,
    activeSessionDays: countStructuredSessionDays(logs, { startDate, endDate }),
    completedSessionDays: countStructuredSessionDays(logs, {
      startDate,
      endDate,
      completedOnly: true,
    }),
    totalMinutes: history.totalMinutes,
    recordedExecutions: history.recordedExecutions,
    attempts: history.attempts,
    successes: history.successes,
    accuracyPct: history.accuracyPct,
  };
}

function templateIdOf(template) {
  return cleanText(valueOf(template, "id", "id", ""), "");
}

function templateSortOrder(template) {
  return Number(valueOf(template, "sortOrder", "sort_order", 0)) || 0;
}

function templateDisplayCode(template) {
  return cleanText(valueOf(template, "displayCode", "display_code", ""), "");
}

function templateName(template) {
  return cleanText(valueOf(template, "name", "name", "Session"), "Session");
}

function templateArchived(template) {
  return !!valueOf(template, "archived", "archived", false);
}

export function buildSessionBalance(
  logs = [],
  sessionTemplates = [],
  { startDate = "", endDate = "" } = {}
) {
  const recorded = getSessionDistribution(logs, { startDate, endDate });
  const recordedById = new Map(recorded.map((row) => [row.templateId, row]));

  const activeRows = (Array.isArray(sessionTemplates) ? sessionTemplates : [])
    .filter((template) => !templateArchived(template) && templateIdOf(template))
    .slice()
    .sort(
      (a, b) =>
        templateSortOrder(a) - templateSortOrder(b) ||
        `${templateDisplayCode(a)}|${templateName(a)}`.localeCompare(
          `${templateDisplayCode(b)}|${templateName(b)}`
        )
    )
    .map((template) => {
      const templateId = templateIdOf(template);
      const historical = recordedById.get(templateId);
      recordedById.delete(templateId);
      return {
        templateId,
        displayCode: templateDisplayCode(template) || historical?.displayCode || "",
        name: templateName(template) || historical?.name || "Session",
        count: historical?.count || 0,
        lastCompletedDate: historical?.lastCompletedDate || "",
        active: true,
        historicalOnly: false,
      };
    });

  const historicalRows = Array.from(recordedById.values())
    .map((row) => ({
      ...row,
      active: false,
      historicalOnly: true,
    }))
    .sort((a, b) =>
      `${a.displayCode}|${a.name}`.localeCompare(`${b.displayCode}|${b.name}`)
    );

  return [...activeRows, ...historicalRows];
}

export function buildMovementTotals(logs = [], options = {}) {
  return aggregateMovementHistory(logs, options).map((row) => ({
    movementId: row.movementId,
    name: row.name,
    timesPerformed: row.timesPerformed,
    recordedExecutions: row.recordedExecutions,
    attempts: row.attempts,
    successes: row.successes,
    accuracyPct: row.accuracyPct,
    bestScore: row.bestScore,
    lastPerformedDate: row.lastPerformedDate,
    // Values stay in separate typed buckets. Progress UI must never add these
    // fields together as though repetitions, attempts and scores shared a unit.
    measures: {
      executions:
        row.recordedExecutions > 0
          ? { kind: "executions", value: row.recordedExecutions }
          : null,
      accuracy:
        row.attempts > 0
          ? {
              kind: "attempts_successes",
              attempts: row.attempts,
              successes: row.successes,
              percentage: row.accuracyPct,
            }
          : null,
      bestScore:
        row.bestScore !== null
          ? { kind: "best_score", value: row.bestScore }
          : null,
    },
  }));
}

export function buildTrainingProgress({
  logs = [],
  profileId = "",
  sessionTemplates = [],
  selectedDate,
} = {}) {
  const scopedLogs = scopeProgressLogs(logs, profileId);
  const windows = buildTrainingProgressWindows(selectedDate);

  const week = buildTrainingWindowSummary(scopedLogs, windows.week);
  const month = buildTrainingWindowSummary(scopedLogs, windows.month);
  const recent28 = buildTrainingWindowSummary(scopedLogs, windows.recent28);
  const lifetime = buildTrainingWindowSummary(scopedLogs, windows.lifetime);
  const sessionBalance = buildSessionBalance(
    scopedLogs,
    sessionTemplates,
    windows.recent28
  );
  const movementTotals = buildMovementTotals(scopedLogs);

  return {
    profileId: cleanText(profileId, ""),
    windows,
    week,
    month,
    recent28,
    lifetime,
    sessionBalance,
    movementTotals,
    hasStructuredSessionHistory:
      lifetime.completedSessions > 0 ||
      lifetime.partialSessions > 0 ||
      movementTotals.length > 0,
  };
}
