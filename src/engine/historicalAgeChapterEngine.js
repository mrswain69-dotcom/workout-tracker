import {
  buildImprovementObservations,
} from "./groupImprovementEngine.js";
import {
  buildAssessmentTestHistory,
  compareAssessmentHistoryEntries,
} from "./assessmentHistoryEngine.js";
import {
  ageChapterDateRange,
  calculateAgeOnDate,
  isValidHistoricalDate,
} from "./historicalAgeEngine.js";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function roundTo(value, places = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** places;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

function profileIdOf(row) {
  const payload = row?.log_json && typeof row.log_json === "object" ? row.log_json : row?.log;
  return cleanText(row?.profile_id || row?.profileId || payload?.profile_id || payload?.profileId, "");
}

function scopeWorkoutLogs(logs = [], profileId = "") {
  if (!profileId) return Array.isArray(logs) ? logs.slice() : [];
  return (Array.isArray(logs) ? logs : []).filter((row) => profileIdOf(row) === profileId);
}

function scopeAssessments(runs = [], results = [], profileId = "") {
  const scopedRuns = (Array.isArray(runs) ? runs : []).filter((run) => {
    if (!profileId) return true;
    return cleanText(run?.profile_id || run?.profileId) === profileId;
  });
  const runIds = new Set(scopedRuns.map((run) => cleanText(run?.id)).filter(Boolean));
  return {
    runs: scopedRuns,
    results: (Array.isArray(results) ? results : []).filter((result) =>
      runIds.has(cleanText(result?.assessment_run_id || result?.assessmentRunId))
    ),
  };
}

function movementLabels(events = []) {
  const labels = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    for (const strength of Array.isArray(event?.evidence?.strength) ? event.evidence.strength : []) {
      const movementId = cleanText(strength?.movementId);
      const name = cleanText(strength?.name);
      if (movementId && name && !labels.has(movementId)) labels.set(movementId, name);
    }
  }
  return labels;
}

function parseObservationKey(observation, labels = new Map(), assessmentNames = new Map()) {
  const key = cleanText(observation?.key);
  const parts = key.split(":");
  if (parts[0] === "training") {
    const movementId = parts[2] || "";
    const metricKind = parts[3] || "performance";
    return {
      category: "strength",
      label: labels.get(movementId) || "Recorded strength movement",
      metricLabel: metricKind === "weighted_set_work" ? "Best weighted set work" : "Best set reps",
      metricKind,
      movementId,
      unit: metricKind === "weighted_set_work" ? "load × reps" : "reps",
    };
  }
  if (parts[0] === "cardio") {
    const sport = parts[1] || "cardio";
    const bucket = parts[2] || "";
    return {
      category: "cardio",
      label: `${sport.replace(/-/g, " ")} ${bucket}`.trim(),
      metricLabel: "Average speed",
      metricKind: "speed",
      movementId: "",
      unit: "km/h",
    };
  }
  if (parts[0] === "assessment") {
    const testId = parts[1] || "";
    return {
      category: "assessment",
      label: assessmentNames.get(testId) || "Assessment Test",
      metricLabel: "Assessment result",
      metricKind: "assessment",
      movementId: "",
      unit: "",
    };
  }
  return {
    category: observation?.source === "assessment" ? "assessment" : "training",
    label: "Recorded performance",
    metricLabel: "Performance",
    metricKind: "performance",
    movementId: "",
    unit: "",
  };
}

function buildObservationSeries(observations = [], { events = [], assessmentHistory = [] } = {}) {
  const labels = movementLabels(events);
  const assessmentNames = new Map(
    (Array.isArray(assessmentHistory) ? assessmentHistory : []).map((summary) => [
      cleanText(summary?.testId),
      cleanText(summary?.testName, "Assessment Test"),
    ])
  );
  const byKey = new Map();

  for (const observation of Array.isArray(observations) ? observations : []) {
    const key = cleanText(observation?.key);
    if (!key || !isValidHistoricalDate(observation?.date)) continue;
    const metadata = parseObservationKey(observation, labels, assessmentNames);
    const list = byKey.get(key) || [];
    list.push({
      date: observation.date,
      value: finite(observation.value),
      direction: observation.direction === "lower" ? "lower" : "higher",
      source: observation.source || "training",
      ...metadata,
    });
    byKey.set(key, list);
  }

  return Array.from(byKey.entries())
    .map(([key, points]) => {
      const sorted = points.slice().sort((a, b) => a.date.localeCompare(b.date));
      return {
        key,
        category: sorted[0]?.category || "training",
        label: sorted[0]?.label || "Recorded performance",
        metricLabel: sorted[0]?.metricLabel || "Performance",
        metricKind: sorted[0]?.metricKind || "performance",
        unit: sorted[0]?.unit || "",
        direction: sorted[0]?.direction || "higher",
        points: sorted,
        firstDate: sorted[0]?.date || "",
        lastDate: sorted.at(-1)?.date || "",
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label) || a.key.localeCompare(b.key));
}

function isBetter(direction, current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return false;
  return direction === "lower" ? current < previous : current > previous;
}

function signedImprovementPct(direction, current, previous) {
  if (!(previous > 0) || !(current >= 0)) return null;
  const raw = direction === "lower"
    ? ((previous - current) / previous) * 100
    : ((current - previous) / previous) * 100;
  return Number.isFinite(raw) ? roundTo(raw, 1) : null;
}

function buildObservationHighlights(series = [], birthDate = null) {
  const highlights = [];
  for (const item of Array.isArray(series) ? series : []) {
    let best = null;
    for (const point of item.points || []) {
      if (best === null) {
        best = point;
        continue;
      }
      if (!isBetter(item.direction, point.value, best.value)) continue;
      highlights.push({
        id: `improvement:${item.key}:${point.date}`,
        date: point.date,
        age: calculateAgeOnDate(birthDate, point.date),
        category: item.category,
        kind: "record_improvement",
        title: item.label,
        metricLabel: item.metricLabel,
        unit: item.unit,
        previousBestValue: best.value,
        value: point.value,
        percentageImprovement: signedImprovementPct(item.direction, point.value, best.value),
        source: point.source,
      });
      best = point;
    }
  }
  return highlights;
}

function buildAssessmentPbHighlights(assessmentHistory = [], birthDate = null) {
  const highlights = [];

  for (const summary of Array.isArray(assessmentHistory) ? assessmentHistory : []) {
    const entries = Array.isArray(summary?.entries) ? summary.entries : [];
    for (let index = 1; index < entries.length; index += 1) {
      const entry = entries[index];
      const markers = entry?.recordMarkers || {};
      const dimensions = ["overall", "left", "right"].filter((dimension) => markers[dimension]);
      if (!dimensions.length) continue;

      // Percentage-safe Assessment metrics are already represented by the
      // canonical improvement-observation series. Keep this adapter for PBs
      // whose metric deliberately forbids percentage improvement, and for
      // side-specific PB context.
      const previous = entries
        .slice(0, index)
        .reverse()
        .find((candidate) => candidate?.metricKey === entry?.metricKey) || null;
      const comparison = compareAssessmentHistoryEntries(entry, previous);

      for (const dimension of dimensions) {
        const detail = comparison?.comparison?.dimensions?.[dimension] || null;
        if (detail?.percentageImprovement !== null && detail?.percentageImprovement !== undefined) {
          continue;
        }
        highlights.push({
          id: `assessment-pb:${summary.testId}:${entry.id}:${dimension}`,
          date: entry.dateYmd,
          age: calculateAgeOnDate(birthDate, entry.dateYmd),
          category: "assessment",
          kind: "personal_best",
          title: summary.testName,
          metricLabel: dimension === "overall" ? "Personal best" : `${dimension} personal best`,
          unit: entry?.metric?.unit || "",
          previousBestValue: detail?.previous ?? null,
          value: detail?.current ?? null,
          percentageImprovement: null,
          improvementValue: detail?.improvementValue ?? null,
          displayValue: entry.displayValue,
          source: "assessment",
        });
      }
    }
  }

  return highlights;
}

function rawRecordedCount(events = [], category) {
  let count = 0;
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.sourceType !== "workout") continue;
    if (category === "strength") count += Array.isArray(event?.evidence?.strength) ? event.evidence.strength.length : 0;
    if (category === "cardio") count += Array.isArray(event?.evidence?.cardio) ? event.evidence.cardio.length : 0;
  }
  return count;
}

function evidenceState({ recordedCount = 0, series = [] } = {}) {
  if (Array.isArray(series) && series.length) return "ready";
  if (recordedCount > 0) return "recorded_only";
  return "empty";
}

function dateInside(date, range) {
  return !!date && !!range && date >= range.startDate && date <= range.endDate;
}

function uniqueDates(events, predicate) {
  return new Set((Array.isArray(events) ? events : []).filter(predicate).map((event) => event.date)).size;
}

function sliceSeriesToRange(series = [], range) {
  return (Array.isArray(series) ? series : [])
    .map((item) => ({
      ...item,
      points: (item.points || []).filter((point) => dateInside(point.date, range)),
    }))
    .filter((item) => item.points.length > 0);
}

function assessmentSummariesInRange(assessmentHistory = [], range) {
  return (Array.isArray(assessmentHistory) ? assessmentHistory : [])
    .map((summary) => {
      const entries = (summary.entries || []).filter((entry) => dateInside(entry.dateYmd, range));
      return entries.length
        ? {
            testId: summary.testId,
            testName: summary.testName,
            metric: summary.metric,
            count: entries.length,
            entries,
            first: entries[0],
            latest: entries.at(-1),
          }
        : null;
    })
    .filter(Boolean);
}

export function buildHistoricalTrendEvidence({
  events = [],
  workoutLogs = [],
  assessmentRuns = [],
  assessmentResults = [],
  profileId = "",
  birthDate = null,
} = {}) {
  const scopedEvents = (Array.isArray(events) ? events : []).filter(
    (event) => !profileId || !event?.profileId || event.profileId === profileId
  );
  const scopedWorkoutLogs = scopeWorkoutLogs(workoutLogs, profileId);
  const scopedAssessment = scopeAssessments(assessmentRuns, assessmentResults, profileId);
  const assessmentHistory = buildAssessmentTestHistory(scopedAssessment);
  const observations = buildImprovementObservations({
    workoutLogs: scopedWorkoutLogs,
    assessmentRuns: scopedAssessment.runs,
    assessmentResults: scopedAssessment.results,
  });
  const series = buildObservationSeries(observations, {
    events: scopedEvents,
    assessmentHistory,
  });

  const strengthSeries = series.filter((item) => item.category === "strength");
  const cardioSeries = series.filter((item) => item.category === "cardio");
  const assessmentSeries = series.filter((item) => item.category === "assessment");
  const improvementHighlights = [
    ...buildObservationHighlights(series, birthDate),
    ...buildAssessmentPbHighlights(assessmentHistory, birthDate),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const strengthRecordedCount = rawRecordedCount(scopedEvents, "strength");
  const cardioRecordedCount = rawRecordedCount(scopedEvents, "cardio");

  return {
    strength: {
      state: evidenceState({ recordedCount: strengthRecordedCount, series: strengthSeries }),
      recordedCount: strengthRecordedCount,
      series: strengthSeries,
    },
    cardio: {
      state: evidenceState({ recordedCount: cardioRecordedCount, series: cardioSeries }),
      recordedCount: cardioRecordedCount,
      series: cardioSeries,
    },
    assessment: {
      state: assessmentHistory.length ? "ready" : "empty",
      histories: assessmentHistory,
      series: assessmentSeries,
    },
    improvementHighlights,
  };
}

export function buildHistoricalAgeChapters({
  events = [],
  workoutLogs = [],
  assessmentRuns = [],
  assessmentResults = [],
  profileId = "",
  birthDate = null,
} = {}) {
  const scopedEvents = (Array.isArray(events) ? events : []).filter(
    (event) => !profileId || !event?.profileId || event.profileId === profileId
  );

  if (!isValidHistoricalDate(birthDate)) {
    return {
      available: false,
      reason: "birth_date_required",
      chapters: [],
      unassignedEvents: scopedEvents,
      trendEvidence: buildHistoricalTrendEvidence({
        events: scopedEvents,
        workoutLogs,
        assessmentRuns,
        assessmentResults,
        profileId,
        birthDate: null,
      }),
    };
  }

  const trendEvidence = buildHistoricalTrendEvidence({
    events: scopedEvents,
    workoutLogs,
    assessmentRuns,
    assessmentResults,
    profileId,
    birthDate,
  });
  const ages = Array.from(
    new Set(
      scopedEvents
        .map((event) => calculateAgeOnDate(birthDate, event?.date))
        .filter((age) => Number.isInteger(age) && age >= 0)
    )
  ).sort((a, b) => a - b);

  const chapters = ages.map((age) => {
    const range = ageChapterDateRange(birthDate, age);
    const chapterEvents = scopedEvents.filter((event) => dateInside(event.date, range));
    const strengthSeries = sliceSeriesToRange(trendEvidence.strength.series, range);
    const cardioSeries = sliceSeriesToRange(trendEvidence.cardio.series, range);
    const assessmentHistories = assessmentSummariesInRange(trendEvidence.assessment.histories, range);
    const highlights = trendEvidence.improvementHighlights.filter((highlight) => dateInside(highlight.date, range));
    const strengthRecordedCount = rawRecordedCount(chapterEvents, "strength");
    const cardioRecordedCount = rawRecordedCount(chapterEvents, "cardio");

    return {
      age,
      label: `Age ${age}`,
      ...range,
      firstEvidenceDate: chapterEvents[0]?.date || "",
      lastEvidenceDate: chapterEvents.at(-1)?.date || "",
      eventCount: chapterEvents.length,
      trainingDays: uniqueDates(
        chapterEvents,
        (event) => event?.sourceType === "workout" && event?.eventType === "training_day"
      ),
      recoveryDays: uniqueDates(
        chapterEvents,
        (event) => event?.sourceType === "workout" && event?.eventType === "recovery_day"
      ),
      structuredSessions: chapterEvents.filter((event) => event?.sourceType === "session").length,
      events: chapterEvents,
      strength: {
        state: evidenceState({ recordedCount: strengthRecordedCount, series: strengthSeries }),
        recordedCount: strengthRecordedCount,
        series: strengthSeries,
      },
      cardio: {
        state: evidenceState({ recordedCount: cardioRecordedCount, series: cardioSeries }),
        recordedCount: cardioRecordedCount,
        series: cardioSeries,
      },
      assessment: {
        state: assessmentHistories.length ? "ready" : "empty",
        histories: assessmentHistories,
      },
      improvementHighlights: highlights,
      awards: chapterEvents.filter((event) => event?.sourceType === "group_award"),
      knowledge: {
        state: "not_available_yet",
        milestones: [],
      },
    };
  });

  return {
    available: true,
    reason: chapters.length ? null : "no_historical_evidence",
    chapters,
    unassignedEvents: [],
    trendEvidence,
  };
}
