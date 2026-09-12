import { buildBadgeStatsV2 } from "./badgeStatsV2.js";
import {
  CONSISTENCY_SCORE_VERSION,
  getConsistencyWeekStartYmd,
  scoreConsistencyWindow,
  shiftConsistencyYmd,
} from "./consistencyEngine.js";
import {
  calculateAgeOnDate,
  isValidHistoricalDate,
} from "./historicalAgeEngine.js";
import { buildHistoricalTrendEvidence } from "./historicalAgeChapterEngine.js";
import { sortHistoricalTimelineEvents } from "./historicalTimelineEventEngine.js";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function profileIdOf(row) {
  const payload = row?.log_json && typeof row.log_json === "object"
    ? row.log_json
    : row?.log;
  return cleanText(
    row?.profile_id || row?.profileId || payload?.profile_id || payload?.profileId,
    ""
  );
}

function workoutDate(row) {
  const payload = row?.log_json && typeof row.log_json === "object"
    ? row.log_json
    : row?.log;
  const date = cleanText(row?.date_ymd || row?.date || payload?.date_ymd || payload?.date, "");
  return isValidHistoricalDate(date) ? date : "";
}

function workoutLog(row) {
  const log = row?.log ?? row?.log_json;
  return log && typeof log === "object" && !Array.isArray(log) ? log : null;
}

function scopeWorkoutLogs(logs = [], profileId = "") {
  return (Array.isArray(logs) ? logs : [])
    .filter((row) => {
      const owner = profileIdOf(row);
      return !profileId || !owner || owner === profileId;
    })
    .map((row) => ({
      ...row,
      date_ymd: workoutDate(row),
      log: workoutLog(row),
    }))
    .filter((row) => row.date_ymd && row.log)
    .sort((a, b) => a.date_ymd.localeCompare(b.date_ymd));
}

function scopeSnapshots(rows = [], profileId = "") {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => {
      const owner = cleanText(row?.profile_id || row?.profileId, "");
      return !profileId || !owner || owner === profileId;
    })
    .filter((row) => isValidHistoricalDate(row?.effective_date || row?.effectiveDate))
    .slice()
    .sort((a, b) =>
      cleanText(a?.effective_date || a?.effectiveDate).localeCompare(
        cleanText(b?.effective_date || b?.effectiveDate)
      )
    );
}

function earliestSnapshotDate(rows = []) {
  return cleanText(rows[0]?.effective_date || rows[0]?.effectiveDate, "");
}

function latestWorkoutDate(rows = []) {
  return cleanText(rows.at(-1)?.date_ymd, "");
}

function monthStartYmd(ymd) {
  if (!isValidHistoricalDate(ymd)) return "";
  return `${ymd.slice(0, 7)}-01`;
}

function monthEndYmd(ymd) {
  if (!isValidHistoricalDate(ymd)) return "";
  const date = new Date(`${ymd.slice(0, 7)}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return date.toISOString().slice(0, 10);
}

function nextMonthStart(ymd) {
  if (!isValidHistoricalDate(ymd)) return "";
  const date = new Date(`${ymd.slice(0, 7)}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1, 1);
  return date.toISOString().slice(0, 10);
}

function consistencyMilestoneTitle(periodType, pct) {
  const label = periodType === "month" ? "month" : "week";
  if (pct >= 100) return `Perfect consistency ${label}`;
  if (pct >= 95) return `95% consistency ${label}`;
  return `90% consistency ${label}`;
}

function consistencyThreshold(pct) {
  if (pct >= 100) return 100;
  if (pct >= 95) return 95;
  if (pct >= 90) return 90;
  return null;
}

function consistencyEvent({
  periodType,
  score,
  profileId,
  birthDate,
}) {
  const threshold = consistencyThreshold(Number(score?.consistencyPct));
  if (!threshold) return null;
  const sourceId = `${periodType}:${score.startDate}`;
  return {
    id: `consistency:${sourceId}`,
    profileId: cleanText(profileId),
    date: score.endDate,
    age: calculateAgeOnDate(birthDate, score.endDate),
    sourceType: "consistency",
    sourceId,
    eventType: periodType === "month" ? "consistency_month" : "consistency_week",
    title: consistencyMilestoneTitle(periodType, Number(score.consistencyPct)),
    evidence: {
      periodType,
      periodStart: score.startDate,
      periodEnd: score.endDate,
      plannedDays: score.plannedDays,
      completedDays: score.completedDays,
      consistencyPct: Number(score.consistencyPct),
      milestoneThresholdPct: threshold,
      scoreVersion: CONSISTENCY_SCORE_VERSION,
    },
    evidenceState: "derived_from_authoritative_schedule",
  };
}

export function buildConsistencyMilestoneEvents({
  logs = [],
  consistencySnapshots = [],
  profileId = "",
  birthDate = null,
  referenceDate = "",
} = {}) {
  const scopedLogs = scopeWorkoutLogs(logs, profileId);
  const scopedSnapshots = scopeSnapshots(consistencySnapshots, profileId);
  const firstSnapshot = earliestSnapshotDate(scopedSnapshots);
  const throughDate = isValidHistoricalDate(referenceDate)
    ? referenceDate
    : latestWorkoutDate(scopedLogs);

  if (!firstSnapshot || !throughDate || firstSnapshot > throughDate) {
    return {
      state: firstSnapshot ? "no_completed_periods" : "schedule_unavailable",
      firstSupportedDate: firstSnapshot || "",
      referenceDate: throughDate || "",
      events: [],
      scoredWeeks: [],
      scoredMonths: [],
    };
  }

  const scoredWeeks = [];
  let weekStart = getConsistencyWeekStartYmd(firstSnapshot);
  while (weekStart) {
    const weekEnd = shiftConsistencyYmd(weekStart, 6);
    if (!weekEnd || weekEnd > throughDate) break;
    const score = scoreConsistencyWindow({
      window: {
        key: weekStart,
        startDate: weekStart,
        endDate: weekEnd,
        complete: true,
      },
      scheduleSnapshots: scopedSnapshots,
      logs: scopedLogs,
    });
    if (score.available && score.reason !== "schedule_unavailable") {
      scoredWeeks.push(score);
    }
    weekStart = shiftConsistencyYmd(weekStart, 7);
  }

  const scoredMonths = [];
  let monthStart = monthStartYmd(firstSnapshot);
  while (monthStart) {
    const monthEnd = monthEndYmd(monthStart);
    if (!monthEnd || monthEnd > throughDate) break;
    const score = scoreConsistencyWindow({
      window: {
        key: monthStart,
        startDate: monthStart,
        endDate: monthEnd,
        complete: true,
      },
      scheduleSnapshots: scopedSnapshots,
      logs: scopedLogs,
    });
    if (score.available && score.reason !== "schedule_unavailable") {
      scoredMonths.push(score);
    }
    monthStart = nextMonthStart(monthStart);
  }

  const events = [
    ...scoredWeeks.map((score) =>
      consistencyEvent({ periodType: "week", score, profileId, birthDate })
    ),
    ...scoredMonths.map((score) =>
      consistencyEvent({ periodType: "month", score, profileId, birthDate })
    ),
  ].filter(Boolean);

  return {
    state: scoredWeeks.length || scoredMonths.length ? "ready" : "insufficient_supported_history",
    firstSupportedDate: firstSnapshot,
    referenceDate: throughDate,
    events: sortHistoricalTimelineEvents(events),
    scoredWeeks,
    scoredMonths,
  };
}

const KNOWLEDGE_EVENT_TYPES = new Set([
  "knowledge_module_completed",
  "knowledge_level_reached",
  "knowledge_streak_milestone",
  "knowledge_mastery_reached",
]);

export function buildKnowledgeMilestoneEvents(
  milestones = [],
  {
    profileId = "",
    birthDate = null,
    sourceAvailable = false,
  } = {}
) {
  if (!sourceAvailable) {
    return { state: "not_available_yet", events: [] };
  }

  const events = [];
  for (const row of Array.isArray(milestones) ? milestones : []) {
    const owner = cleanText(row?.profile_id || row?.profileId, "");
    if (profileId && owner && owner !== profileId) continue;
    const date = cleanText(row?.date_ymd || row?.dateYmd || row?.date, "");
    if (!isValidHistoricalDate(date)) continue;
    const sourceId = cleanText(row?.id || row?.sourceId, "");
    const eventType = cleanText(row?.event_type || row?.eventType, "");
    if (!sourceId || !KNOWLEDGE_EVENT_TYPES.has(eventType)) continue;

    events.push({
      id: `knowledge:${sourceId}:${eventType}:${date}`,
      profileId: owner || profileId,
      date,
      age: calculateAgeOnDate(birthDate, date),
      sourceType: "knowledge",
      sourceId,
      eventType,
      title: cleanText(row?.title, "Knowledge milestone"),
      evidence:
        row?.evidence && typeof row.evidence === "object" && !Array.isArray(row.evidence)
          ? { ...row.evidence }
          : {},
      evidenceState: "recorded",
    });
  }

  return {
    state: events.length ? "ready" : "empty",
    events: sortHistoricalTimelineEvents(events),
  };
}

export function composeHistoricalMilestones({
  events = [],
  logs = [],
  consistencySnapshots = [],
  knowledgeMilestones = [],
  knowledgeSourceAvailable = false,
  profileId = "",
  birthDate = null,
  referenceDate = "",
} = {}) {
  const consistency = buildConsistencyMilestoneEvents({
    logs,
    consistencySnapshots,
    profileId,
    birthDate,
    referenceDate,
  });
  const knowledge = buildKnowledgeMilestoneEvents(knowledgeMilestones, {
    profileId,
    birthDate,
    sourceAvailable: knowledgeSourceAvailable,
  });

  return {
    events: sortHistoricalTimelineEvents([
      ...(Array.isArray(events) ? events : []),
      ...consistency.events,
      ...knowledge.events,
    ]),
    consistency,
    knowledge,
  };
}

function addCalendarYearsClamped(ymd, years) {
  if (!isValidHistoricalDate(ymd)) return "";
  const [year, month, day] = ymd.split("-").map(Number);
  const targetYear = year + Number(years || 0);
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  return `${String(targetYear).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

function calendarYear(date) {
  return isValidHistoricalDate(date) ? Number(date.slice(0, 4)) : null;
}

function uniqueTrainingDays(events = []) {
  return new Set(
    (Array.isArray(events) ? events : [])
      .filter((event) => event?.sourceType === "workout" && event?.eventType === "training_day")
      .map((event) => event.date)
  ).size;
}

function structuredSessionCounts(events = []) {
  const sessions = (Array.isArray(events) ? events : []).filter(
    (event) => event?.sourceType === "session"
  );
  return {
    total: sessions.length,
    completed: sessions.filter((event) => event.eventType === "session_completed").length,
    partial: sessions.filter((event) => event.eventType === "session_partial").length,
  };
}

function groupAwardSummary(events = []) {
  const awards = (Array.isArray(events) ? events : []).filter(
    (event) => event?.sourceType === "group_award"
  );
  const seasonAwards = awards.filter((event) => event?.eventType === "season_award");
  const seasonWins = seasonAwards.filter((event) => {
    const type = cleanText(event?.evidence?.awardType);
    return ["season_xp", "season_consistency", "season_improvement"].includes(type);
  });
  return {
    totalFrozenAwards: awards.length,
    seasonAwards: seasonAwards.length,
    seasonWins: seasonWins.length,
    seasonFinishers: seasonAwards.filter(
      (event) => cleanText(event?.evidence?.awardType) === "season_finisher"
    ).length,
  };
}

function biggestImprovementYear(highlights = []) {
  const byYear = new Map();
  for (const highlight of Array.isArray(highlights) ? highlights : []) {
    const year = calendarYear(highlight?.date);
    if (!year) continue;
    const bucket = byYear.get(year) || { year, count: 0, metrics: new Set() };
    bucket.count += 1;
    bucket.metrics.add(
      [highlight?.category, highlight?.title, highlight?.metricLabel].map(cleanText).join("|")
    );
    byYear.set(year, bucket);
  }

  const rows = Array.from(byYear.values()).map((row) => ({
    year: row.year,
    milestoneCount: row.count,
    distinctMetricCount: row.metrics.size,
  }));
  if (!rows.length) {
    return {
      available: false,
      reason: "no_improvement_milestones",
      method: "improvement_milestone_count",
      years: [],
      milestoneCount: 0,
      distinctMetricCount: 0,
      tie: false,
    };
  }

  const maxCount = Math.max(...rows.map((row) => row.milestoneCount));
  const countLeaders = rows.filter((row) => row.milestoneCount === maxCount);
  const maxMetrics = Math.max(...countLeaders.map((row) => row.distinctMetricCount));
  const leaders = countLeaders
    .filter((row) => row.distinctMetricCount === maxMetrics)
    .sort((a, b) => a.year - b.year);

  return {
    available: true,
    reason: null,
    method: "improvement_milestone_count_then_distinct_metrics",
    years: leaders.map((row) => row.year),
    milestoneCount: maxCount,
    distinctMetricCount: maxMetrics,
    tie: leaders.length > 1,
  };
}

function metricSpecificLifetime(series = []) {
  return (Array.isArray(series) ? series : [])
    .map((item) => {
      const points = Array.isArray(item?.points) ? item.points : [];
      const first = points[0];
      const last = points.at(-1);
      const firstValue = finite(first?.value);
      const lastValue = finite(last?.value);
      if (points.length < 2 || firstValue === null || lastValue === null) return null;
      const rawChange = item.direction === "lower"
        ? firstValue - lastValue
        : lastValue - firstValue;
      const percentageImprovement = firstValue > 0
        ? (rawChange / firstValue) * 100
        : null;
      return {
        key: item.key,
        category: item.category,
        label: item.label,
        metricLabel: item.metricLabel,
        unit: item.unit,
        firstDate: first.date,
        lastDate: last.date,
        firstValue,
        lastValue,
        improvementValue: Number.isFinite(rawChange) ? rawChange : null,
        percentageImprovement:
          Number.isFinite(percentageImprovement)
            ? Math.round(percentageImprovement * 10) / 10
            : null,
      };
    })
    .filter(Boolean);
}

export function buildCareerSummaryFoundation({
  events = [],
  workoutLogs = [],
  assessmentRuns = [],
  assessmentResults = [],
  profileId = "",
  birthDate = null,
} = {}) {
  const scopedEvents = sortHistoricalTimelineEvents(
    (Array.isArray(events) ? events : []).filter(
      (event) => !profileId || !event?.profileId || event.profileId === profileId
    )
  );
  const evidenceDates = scopedEvents
    .map((event) => cleanText(event?.date))
    .filter(isValidHistoricalDate);
  const firstEvidenceDate = evidenceDates[0] || "";
  const lastEvidenceDate = evidenceDates.at(-1) || "";

  if (!firstEvidenceDate || !lastEvidenceDate) {
    return {
      available: false,
      reason: "no_historical_evidence",
      gate: {
        requiredYears: 3,
        firstEvidenceDate: "",
        lastEvidenceDate: "",
        unlockDate: "",
        unlocked: false,
      },
    };
  }

  const unlockDate = addCalendarYearsClamped(firstEvidenceDate, 3);
  const unlocked = !!unlockDate && lastEvidenceDate >= unlockDate;
  const scopedLogs = scopeWorkoutLogs(workoutLogs, profileId);
  const badgeStats = buildBadgeStatsV2({
    allLogs: scopedLogs,
    todayYmd: lastEvidenceDate,
    isAdult: false,
  });
  const trendEvidence = buildHistoricalTrendEvidence({
    events: scopedEvents,
    workoutLogs: scopedLogs,
    assessmentRuns,
    assessmentResults,
    profileId,
    birthDate,
  });
  const allSeries = [
    ...(trendEvidence?.strength?.series || []),
    ...(trendEvidence?.cardio?.series || []),
    ...(trendEvidence?.assessment?.series || []),
  ];
  const ageStart = calculateAgeOnDate(birthDate, firstEvidenceDate);
  const ageEnd = calculateAgeOnDate(birthDate, lastEvidenceDate);
  const yearsCovered = Array.from(
    new Set(evidenceDates.map(calendarYear).filter(Number.isInteger))
  ).sort((a, b) => a - b);

  const foundation = {
    gate: {
      requiredYears: 3,
      firstEvidenceDate,
      lastEvidenceDate,
      unlockDate,
      unlocked,
    },
    coverage: {
      calendarYears: yearsCovered,
      firstAge: ageStart,
      lastAge: ageEnd,
      ageTimelineAvailable: ageStart !== null && ageEnd !== null,
    },
    training: {
      recordedTrainingDays: uniqueTrainingDays(scopedEvents),
      structuredSessions: structuredSessionCounts(scopedEvents),
    },
    streak: {
      highestWorkoutStreakDays: Number(badgeStats?.streak?.longestDays || 0),
      authority: "badgeStatsV2",
    },
    improvement: {
      milestoneCount: trendEvidence.improvementHighlights.length,
      biggestYear: biggestImprovementYear(trendEvidence.improvementHighlights),
      lifetime: {
        universalPercentage: null,
        state: "metric_specific_only",
        metrics: metricSpecificLifetime(allSeries),
      },
    },
    awards: groupAwardSummary(scopedEvents),
  };

  if (!unlocked) {
    return {
      available: false,
      reason: "three_year_history_required",
      ...foundation,
    };
  }

  return {
    available: true,
    reason: null,
    ...foundation,
  };
}
