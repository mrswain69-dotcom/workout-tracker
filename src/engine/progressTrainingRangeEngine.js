import {
  buildMovementTotals,
  buildSessionBalance,
  buildTrainingProgressWindows,
  buildTrainingTrendSeries,
  buildTrainingWindowSummary,
  scopeProgressLogs,
} from "./progressTrainingEngine.js";

export const TRAINING_DETAIL_RANGE_KEYS = Object.freeze([
  "recent28",
  "month",
  "lifetime",
]);

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function rowDate(row) {
  const payload = row?.log_json && typeof row.log_json === "object"
    ? row.log_json
    : row;
  return cleanText(
    row?.date_ymd || payload?.date_ymd || payload?.date || payload?.ymd,
    ""
  );
}

function monthWindow(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) return null;
  const startDate = `${monthKey}-01`;
  const date = new Date(`${startDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return {
    startDate,
    endDate: date.toISOString().slice(0, 10),
  };
}

function hasStructuredActivity(summary = {}) {
  return (
    Number(summary.completedSessions || 0) > 0 ||
    Number(summary.partialSessions || 0) > 0 ||
    Number(summary.totalMinutes || 0) > 0 ||
    Number(summary.recordedExecutions || 0) > 0 ||
    Number(summary.attempts || 0) > 0
  );
}

// Lifetime charts use only observed structured-Session months. Legacy-only
// workout months are deliberately ignored rather than appearing as synthetic
// zero-volume Session history.
export function buildLifetimeTrainingTrendSeries(logs = []) {
  const monthKeys = Array.from(
    new Set(
      (Array.isArray(logs) ? logs : [])
        .map(rowDate)
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
        .map((date) => date.slice(0, 7))
    )
  ).sort();

  return monthKeys
    .map((monthKey) => {
      const window = monthWindow(monthKey);
      if (!window) return null;
      const summary = buildTrainingWindowSummary(logs, window);
      if (!hasStructuredActivity(summary)) return null;
      return {
        ...summary,
        startDate: window.startDate,
        endDate: window.endDate,
        monthKey,
      };
    })
    .filter(Boolean);
}

function buildRangeView({
  key,
  window,
  logs,
  sessionTemplates,
  trend,
  displayEndDate = window.endDate,
}) {
  const summary = buildTrainingWindowSummary(logs, window);
  return {
    key,
    label: window.label,
    startDate: window.startDate,
    endDate: window.endDate,
    displayEndDate,
    summary,
    trend,
    sessionBalance: buildSessionBalance(logs, sessionTemplates, window),
    movementTotals: buildMovementTotals(logs, window),
  };
}

export function buildTrainingRangeViews({
  logs = [],
  profileId = "",
  sessionTemplates = [],
  selectedDate,
} = {}) {
  const scopedLogs = scopeProgressLogs(logs, profileId);
  const windows = buildTrainingProgressWindows(selectedDate);
  const monthTrendWindow = {
    ...windows.month,
    // "This month" remains a calendar-month summary/filter, but chart buckets
    // stop at the selected/reference date so future days are not shown as
    // zero-performance periods.
    endDate: windows.referenceDate,
  };

  return {
    recent28: buildRangeView({
      key: "recent28",
      window: windows.recent28,
      logs: scopedLogs,
      sessionTemplates,
      trend: buildTrainingTrendSeries(scopedLogs, windows.recent28),
    }),
    month: buildRangeView({
      key: "month",
      window: windows.month,
      logs: scopedLogs,
      sessionTemplates,
      trend: buildTrainingTrendSeries(scopedLogs, monthTrendWindow),
      displayEndDate: windows.referenceDate,
    }),
    lifetime: buildRangeView({
      key: "lifetime",
      window: windows.lifetime,
      logs: scopedLogs,
      sessionTemplates,
      trend: buildLifetimeTrainingTrendSeries(scopedLogs),
    }),
  };
}
