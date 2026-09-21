import {
  buildConsistencyScheduleFromPlan,
  consistencyWeekdayForYmd,
  selectConsistencyScheduleSnapshot,
  shiftConsistencyYmd,
} from "./consistencyEngine.js";

function validYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function normaliseSnapshot(row) {
  if (!row || typeof row !== "object") return null;
  const effectiveDate = String(row.effective_date || row.effectiveDate || "");
  const schedule = row.schedule_json || row.scheduleJson || row.schedule;
  if (!validYmd(effectiveDate) || !schedule || typeof schedule !== "object") return null;
  return { effective_date: effectiveDate, schedule_json: schedule };
}

function rowDate(row) {
  return String(row?.date_ymd || row?.date || "");
}

function rowLog(row) {
  return row?.log || row?.log_json || null;
}

function dayIsPlanned(schedule, dateYmd) {
  const weekday = consistencyWeekdayForYmd(dateYmd);
  return Array.isArray(schedule?.[weekday]) && schedule[weekday].length > 0;
}

/**
 * A workout streak advances on completed activity/recovery or a valid saver,
 * pauses on genuinely unplanned days, and resets on a missed planned day.
 * The current day never resets early while there is still time to complete it.
 */
export function buildWorkoutStreakSeries({
  records = [],
  todayYmd = "",
  scheduleSnapshots = [],
  fallbackPlan = {},
  isDayComplete = () => false,
} = {}) {
  if (!validYmd(todayYmd)) return { currentDays: 0, longestDays: 0, streakByDate: {} };

  const logsByDate = new Map();
  for (const row of Array.isArray(records) ? records : []) {
    const date = rowDate(row);
    const log = rowLog(row);
    if (validYmd(date) && date <= todayYmd && log) logsByDate.set(date, log);
  }

  const snapshots = (Array.isArray(scheduleSnapshots) ? scheduleSnapshots : [])
    .map(normaliseSnapshot)
    .filter(Boolean)
    .sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  const fallbackSchedule = buildConsistencyScheduleFromPlan(fallbackPlan || {});

  // Until dated schedule truth exists, preserve the original calendar-day
  // streak behaviour. This prevents the release from rewriting historic XP
  // or badges for existing accounts.
  if (!snapshots.length) {
    const completeDates = [...logsByDate.entries()]
      .filter(([, log]) => isDayComplete(log) || !!log?.meta?.streakSaved)
      .map(([date]) => date)
      .sort();
    let streak = 0;
    let longestDays = 0;
    let previous = "";
    const streakByDate = {};
    for (const date of completeDates) {
      streak = previous && shiftConsistencyYmd(previous, 1) === date ? streak + 1 : 1;
      longestDays = Math.max(longestDays, streak);
      streakByDate[date] = streak;
      previous = date;
    }
    if (previous && shiftConsistencyYmd(previous, 1) < todayYmd) streak = 0;
    return { currentDays: streak, longestDays, streakByDate };
  }

  const starts = [
    ...logsByDate.keys(),
    ...snapshots.map((snapshot) => snapshot.effective_date),
  ].filter(validYmd).sort();
  if (!starts.length) return { currentDays: 0, longestDays: 0, streakByDate: {} };

  let cursor = starts[0];
  let streak = 0;
  let longestDays = 0;
  const streakByDate = {};
  const firstSnapshotDate = snapshots[0].effective_date;
  let previousLegacyCompletion = "";

  while (cursor <= todayYmd) {
    if (cursor < firstSnapshotDate) {
      const legacyLog = logsByDate.get(cursor) || null;
      const legacyComplete = !!legacyLog && (
        isDayComplete(legacyLog) || !!legacyLog?.meta?.streakSaved
      );
      if (legacyComplete) {
        streak = previousLegacyCompletion && shiftConsistencyYmd(previousLegacyCompletion, 1) === cursor
          ? streak + 1
          : 1;
        longestDays = Math.max(longestDays, streak);
        streakByDate[cursor] = streak;
        previousLegacyCompletion = cursor;
      }
      cursor = shiftConsistencyYmd(cursor, 1);
      continue;
    }

    if (cursor === firstSnapshotDate && previousLegacyCompletion &&
        shiftConsistencyYmd(previousLegacyCompletion, 1) !== cursor) {
      streak = 0;
    }

    const selected = selectConsistencyScheduleSnapshot(snapshots, cursor);
    const schedule = selected?.schedule || fallbackSchedule;
    const log = logsByDate.get(cursor) || null;
    const completed = !!log && (isDayComplete(log) || !!log?.meta?.streakSaved);

    if (completed) {
      streak += 1;
      longestDays = Math.max(longestDays, streak);
      streakByDate[cursor] = streak;
    } else if (cursor < todayYmd && dayIsPlanned(schedule, cursor)) {
      streak = 0;
    }

    cursor = shiftConsistencyYmd(cursor, 1);
  }

  return { currentDays: streak, longestDays, streakByDate };
}
