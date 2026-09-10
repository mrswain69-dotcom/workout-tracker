import {
  formatProgressDate,
  formatProgressRangeLabel,
} from "./progressViewModel.js";
import { TRAINING_DETAIL_RANGE_KEYS } from "./progressTrainingRangeEngine.js";

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function formatMonthKey(monthKey) {
  const text = cleanText(monthKey);
  if (!/^\d{4}-\d{2}$/.test(text)) return text;
  const date = new Date(`${text}-01T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function buildDistribution(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const total = safeRows.reduce(
    (sum, row) => sum + Math.max(0, finiteNumber(row?.count)),
    0
  );
  return {
    total,
    rows: safeRows.map((row) => {
      const count = Math.max(0, finiteNumber(row?.count));
      return {
        ...row,
        count,
        sharePct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        lastCompletedLabel: formatProgressDate(row?.lastCompletedDate),
      };
    }),
  };
}

function buildMovementRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      movementId: cleanText(row?.movementId),
      name: cleanText(row?.name, "Movement"),
      timesPerformed: Math.max(0, finiteNumber(row?.timesPerformed)),
      lastPerformedDate: cleanText(row?.lastPerformedDate),
      lastPerformedLabel: formatProgressDate(row?.lastPerformedDate),
      measures: {
        executions: row?.measures?.executions || null,
        accuracy: row?.measures?.accuracy || null,
        bestScore: row?.measures?.bestScore || null,
      },
    }))
    .sort(
      (a, b) =>
        b.timesPerformed - a.timesPerformed || a.name.localeCompare(b.name)
    );
}

function buildTrend(rows = [], key = "recent28") {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    startDate: cleanText(row?.startDate),
    endDate: cleanText(row?.endDate),
    label:
      key === "lifetime"
        ? formatMonthKey(cleanText(row?.monthKey, cleanText(row?.startDate).slice(0, 7)))
        : formatProgressRangeLabel(row?.startDate, row?.endDate),
    completedSessions: Math.max(0, finiteNumber(row?.completedSessions)),
    partialSessions: Math.max(0, finiteNumber(row?.partialSessions)),
    activeSessionDays: Math.max(0, finiteNumber(row?.activeSessionDays)),
    totalMinutes: Math.max(0, finiteNumber(row?.totalMinutes)),
    recordedExecutions: Math.max(0, finiteNumber(row?.recordedExecutions)),
  }));
}

function buildRangePresentation(key, range = null) {
  const summary = range?.summary || {};
  const distribution = buildDistribution(range?.sessionBalance || []);
  const trend = buildTrend(range?.trend || [], key);
  const attempts = Math.max(0, finiteNumber(summary.attempts));
  const successes = Math.max(0, finiteNumber(summary.successes));
  const accuracyPct =
    summary.accuracyPct === null || summary.accuracyPct === undefined
      ? null
      : finiteNumber(summary.accuracyPct);

  return {
    key,
    label: cleanText(
      range?.label,
      key === "recent28" ? "Last 4 weeks" : key === "month" ? "This month" : "All time"
    ),
    dateLabel:
      key === "lifetime"
        ? "All genuine structured history"
        : formatProgressRangeLabel(
            range?.startDate,
            range?.displayEndDate || range?.endDate
          ),
    completedSessions: Math.max(0, finiteNumber(summary.completedSessions)),
    partialSessions: Math.max(0, finiteNumber(summary.partialSessions)),
    activeSessionDays: Math.max(0, finiteNumber(summary.activeSessionDays)),
    totalMinutes: Math.max(0, finiteNumber(summary.totalMinutes)),
    recordedExecutions: Math.max(0, finiteNumber(summary.recordedExecutions)),
    attempts,
    successes,
    accuracyPct,
    trend,
    trendPeriodLabel: key === "lifetime" ? "active months" : "7-day periods",
    hasTrendActivity: trend.some(
      (row) =>
        row.completedSessions > 0 ||
        row.partialSessions > 0 ||
        row.totalMinutes > 0 ||
        row.recordedExecutions > 0
    ),
    sessionDistributionTotal: distribution.total,
    sessionBalance: distribution.rows,
    movementTotals: buildMovementRows(range?.movementTotals || []),
  };
}

export function buildTrainingRangeViewModel(rangeViews = null) {
  const ranges = {};
  for (const key of TRAINING_DETAIL_RANGE_KEYS) {
    ranges[key] = buildRangePresentation(key, rangeViews?.[key] || null);
  }
  return {
    defaultRangeKey: "recent28",
    options: [
      { key: "recent28", label: "Last 4 weeks" },
      { key: "month", label: "This month" },
      { key: "lifetime", label: "All time" },
    ],
    ranges,
  };
}
