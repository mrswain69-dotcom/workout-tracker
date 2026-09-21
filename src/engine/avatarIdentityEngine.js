import { buildAssessmentTestHistory } from "./assessmentHistoryEngine";
import { buildXpDebugRows } from "./xpEngine";

function timestamp(value) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function rowMoment(dateYmd) {
  return timestamp(dateYmd ? `${dateYmd}T12:00:00.000Z` : "");
}

function periodsForAvatar(periods, avatarId) {
  return (Array.isArray(periods) ? periods : [])
    .filter((period) => period?.avatar_id === avatarId)
    .map((period) => ({
      start: timestamp(period.selected_at),
      end: timestamp(period.deselected_at),
      ...period,
    }))
    .filter((period) => period.start !== null)
    .sort((a, b) => a.start - b.start);
}

function inPeriods(moment, periods) {
  if (moment === null) return false;
  return periods.some((period) => moment >= period.start && (period.end === null || moment < period.end));
}

function blockCompleted(block = {}) {
  if (block.cancelled || block.suspendedByRecoveryMode) return false;
  const type = String(block.typeId || "").toLowerCase();
  if (type === "tasks") return false;
  if (type === "strength" || type === "hiit" || type === "box") {
    return Object.values(block.sets || {}).some((sets) =>
      (Array.isArray(sets) ? sets : []).some((set) =>
        Number(set?.reps) > 0 || Number(set?.weight) > 0 || Number(set?.seconds) > 0 || set?.done === true
      )
    );
  }
  if (["cardio", "run", "walk", "cycle", "bike", "row", "swim"].includes(type)) {
    return Number(block?.cardio?.distanceKm) > 0 || Number(block?.cardio?.durationMin) > 0;
  }
  if (type === "duration") return Number(block?.duration?.minutes) > 0;
  if (type === "session") return !!block.completedAt || block.status === "complete" || block.completed === true;
  if (type === "recovery") return block.recoveryDone === true || block.completed === true;
  return !!block.completedAt || block.completed === true;
}

function selectedDurationMs(periods, nowMs) {
  return periods.reduce(
    (total, period) => total + Math.max(0, (period.end ?? nowMs) - period.start),
    0
  );
}

function assessmentPbCount(history, periods) {
  if (!history?.runs?.length || !history?.results?.length) return 0;
  return buildAssessmentTestHistory(history).reduce(
    (count, summary) => count + summary.entries.reduce((entryCount, entry) => {
      const isRecord = Object.values(entry.recordMarkers || {}).some(Boolean);
      return entryCount + (isRecord && inPeriods(timestamp(entry.completedAt) ?? rowMoment(entry.dateYmd), periods) ? 1 : 0);
    }, 0),
    0
  );
}

export function buildAvatarPersonalStats({
  avatarId,
  periods = [],
  logs = [],
  plan = {},
  assessmentHistory = null,
  groupAwards = [],
  now = new Date(),
} = {}) {
  const trackingStartedAt = (Array.isArray(periods) ? periods : [])
    .map((period) => period?.selected_at)
    .filter(Boolean)
    .sort()[0] || null;
  const selectedPeriods = periodsForAvatar(periods, avatarId);
  const firstSelectedAt = selectedPeriods[0]?.selected_at || null;
  const nowMs = now.getTime();
  const xpRows = buildXpDebugRows(logs, plan);

  let xpEarned = 0;
  let workoutsCompleted = 0;
  for (const row of xpRows) {
    if (inPeriods(rowMoment(row.date), selectedPeriods)) xpEarned += Number(row.totalXp) || 0;
  }
  for (const record of Array.isArray(logs) ? logs : []) {
    const date = record?.date_ymd || record?.date;
    if (!inPeriods(rowMoment(date), selectedPeriods)) continue;
    workoutsCompleted += (record?.log?.blocks || []).filter(blockCompleted).length;
  }

  return {
    trackingStartedAt,
    firstSelectedAt,
    selectedDurationMs: selectedDurationMs(selectedPeriods, nowMs),
    selectionCount: selectedPeriods.length,
    xpEarned,
    workoutsCompleted,
    personalRecords: assessmentPbCount(assessmentHistory, selectedPeriods),
    competitionAchievements: (Array.isArray(groupAwards) ? groupAwards : []).filter((award) =>
      inPeriods(timestamp(award?.awarded_at), selectedPeriods)
    ).length,
  };
}
