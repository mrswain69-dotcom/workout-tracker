export const CONSISTENCY_SCORE_VERSION = 1;
export const CONSISTENCY_TIME_ZONE = "Europe/London";

export const CONSISTENCY_ELIGIBLE_BLOCK_TYPES = Object.freeze([
  "strength",
  "hiit",
  "box",
  "cardio",
  "run",
  "swim",
  "walk",
  "row",
  "cycle",
  "bike",
  "duration",
  "session",
  "recovery",
]);

const ELIGIBLE_TYPES = new Set(CONSISTENCY_ELIGIBLE_BLOCK_TYPES);
const WEEKDAYS = Object.freeze(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);

function cleanText(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function parseYmd(value) {
  const text = cleanText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function shiftConsistencyYmd(value, days) {
  const date = parseYmd(value);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

export function getConsistencyWeekStartYmd(referenceYmd) {
  const date = parseYmd(referenceYmd);
  if (!date) return "";
  const diffToMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diffToMonday);
  return date.toISOString().slice(0, 10);
}

export function getCurrentConsistencyWeekWindow(referenceYmd) {
  const startDate = getConsistencyWeekStartYmd(referenceYmd);
  if (!startDate) return null;
  return {
    key: startDate,
    startDate,
    endDate: shiftConsistencyYmd(startDate, 6),
    complete: false,
  };
}

export function getPreviousCompletedConsistencyWeekWindows(referenceYmd, count = 4) {
  const currentStart = getConsistencyWeekStartYmd(referenceYmd);
  if (!currentStart) return [];
  const size = Math.max(0, Math.min(12, Number(count) || 0));
  return Array.from({ length: size }, (_, index) => {
    const startDate = shiftConsistencyYmd(currentStart, -7 * (index + 1));
    return {
      key: startDate,
      startDate,
      endDate: shiftConsistencyYmd(startDate, 6),
      complete: true,
    };
  });
}

export function consistencyWeekdayForYmd(value) {
  const date = parseYmd(value);
  return date ? WEEKDAYS[date.getUTCDay()] : "";
}

export function isConsistencyEligiblePlanBlock(block) {
  if (!block || typeof block !== "object" || block.cancelled) return false;
  return ELIGIBLE_TYPES.has(cleanText(block.typeId).toLowerCase());
}

export function buildConsistencyScheduleFromPlan(plan = {}) {
  const blocksByWeekday = plan?.blocksByWeekday && typeof plan.blocksByWeekday === "object"
    ? plan.blocksByWeekday
    : {};
  const schedule = {};

  for (const weekday of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
    const blocks = Array.isArray(blocksByWeekday[weekday]) ? blocksByWeekday[weekday] : [];
    schedule[weekday] = blocks
      .filter(isConsistencyEligiblePlanBlock)
      .map((block) => ({
        id: cleanText(block.id),
        typeId: cleanText(block.typeId).toLowerCase(),
      }))
      .filter((block) => block.id && block.typeId);
  }

  return schedule;
}

function scheduleEffectiveDate(row) {
  return cleanText(row?.effective_date || row?.effectiveDate);
}

function schedulePayload(row) {
  const value = row?.schedule_json ?? row?.scheduleJson ?? row?.schedule;
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function selectConsistencyScheduleSnapshot(snapshots = [], targetYmd = "") {
  if (!parseYmd(targetYmd)) return null;
  let selected = null;
  let selectedDate = "";

  for (const row of Array.isArray(snapshots) ? snapshots : []) {
    const effectiveDate = scheduleEffectiveDate(row);
    const schedule = schedulePayload(row);
    if (!schedule || !parseYmd(effectiveDate) || effectiveDate > targetYmd) continue;
    if (!selected || effectiveDate > selectedDate) {
      selected = schedule;
      selectedDate = effectiveDate;
    }
  }

  return selected ? { effectiveDate: selectedDate, schedule: selected } : null;
}

function timestampYmd(value, timeZone = CONSISTENCY_TIME_ZONE) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year || ""}-${byType.month || ""}-${byType.day || ""}`;
}

function setDidSomething(set) {
  if (!set || typeof set !== "object") return false;
  return (
    finiteNumber(set.reps) > 0 ||
    finiteNumber(set.timeSeconds) > 0 ||
    finiteNumber(set.count) > 0 ||
    finiteNumber(set.distanceKm) > 0 ||
    finiteNumber(set.durationMin) > 0
  );
}

function blockHasSameDayEvidence(block, targetYmd) {
  const firstActivity = block?.loggedAt || block?.startedAt || "";
  return timestampYmd(firstActivity) === targetYmd;
}

export function consistencyLogBlockCompletedOnDay(block, targetYmd) {
  if (!block || typeof block !== "object" || block.cancelled || !parseYmd(targetYmd)) return false;
  const typeId = cleanText(block.typeId).toLowerCase();
  if (!ELIGIBLE_TYPES.has(typeId)) return false;

  if (typeId === "session") {
    const session = block.session && typeof block.session === "object" ? block.session : block;
    return !!session.completed && timestampYmd(session.completedAt) === targetYmd;
  }

  if (!blockHasSameDayEvidence(block, targetYmd)) return false;

  if (typeId === "strength" || typeId === "hiit" || typeId === "box") {
    const sets = block.sets && typeof block.sets === "object" ? block.sets : {};
    return Object.values(sets).some(
      (items) => Array.isArray(items) && items.some(setDidSomething)
    );
  }

  if (["cardio", "run", "swim", "walk", "row", "cycle", "bike"].includes(typeId)) {
    return finiteNumber(block?.cardio?.distanceKm) > 0 || finiteNumber(block?.cardio?.durationMin) > 0;
  }

  if (typeId === "duration") {
    return finiteNumber(block?.duration?.minutes) > 0;
  }

  if (typeId === "recovery") {
    return !!block.recoveryDone;
  }

  return false;
}

function rowDate(row) {
  return cleanText(row?.date_ymd || row?.date);
}

function rowLog(row) {
  return row?.log || row?.log_json || null;
}

export function normaliseConsistencyRecords(records = []) {
  return (Array.isArray(records) ? records : [])
    .map((row) => ({ date_ymd: rowDate(row), log: rowLog(row) }))
    .filter((row) => parseYmd(row.date_ymd) && row.log && typeof row.log === "object")
    .sort((a, b) => a.date_ymd.localeCompare(b.date_ymd));
}

export function consistencyPlannedDayCompleted({ dateYmd, schedule, log }) {
  const weekday = consistencyWeekdayForYmd(dateYmd);
  const expected = Array.isArray(schedule?.[weekday]) ? schedule[weekday] : [];
  if (!expected.length) {
    return { planned: false, completed: false, expectedBlocks: 0, completedBlocks: 0 };
  }

  const logBlocks = Array.isArray(log?.blocks) ? log.blocks : [];
  let completedBlocks = 0;

  for (const expectedBlock of expected) {
    const match = logBlocks.find(
      (block) => block && cleanText(block.id) === cleanText(expectedBlock?.id)
    );
    if (match && consistencyLogBlockCompletedOnDay(match, dateYmd)) completedBlocks += 1;
  }

  return {
    planned: true,
    completed: completedBlocks === expected.length,
    expectedBlocks: expected.length,
    completedBlocks,
  };
}

function maxYmd(...values) {
  return values.filter((value) => parseYmd(value)).sort().at(-1) || "";
}

function minYmd(...values) {
  return values.filter((value) => parseYmd(value)).sort()[0] || "";
}

export function scoreConsistencyWindow({
  window,
  referenceDate = "",
  eligibleFrom = "",
  eligibleThrough = "",
  scheduleSnapshots = [],
  logs = [],
} = {}) {
  if (!window || !parseYmd(window.startDate) || !parseYmd(window.endDate)) {
    throw new Error("Invalid consistency window");
  }

  const records = normaliseConsistencyRecords(logs);
  const logByDate = new Map(records.map((row) => [row.date_ymd, row.log]));
  const startDate = maxYmd(window.startDate, eligibleFrom) || window.startDate;
  const dueThrough = window.complete
    ? minYmd(window.endDate, eligibleThrough) || window.endDate
    : minYmd(window.endDate, referenceDate, eligibleThrough) || minYmd(window.endDate, referenceDate) || window.endDate;

  if (startDate > dueThrough) {
    return {
      available: false,
      reason: "not_started",
      startDate: window.startDate,
      endDate: window.endDate,
      eligibleFrom: startDate,
      dueThrough,
      plannedDays: 0,
      completedDays: 0,
      consistencyPct: null,
      dayResults: [],
    };
  }

  const dayResults = [];
  let cursor = startDate;
  while (cursor <= dueThrough) {
    const snapshot = selectConsistencyScheduleSnapshot(scheduleSnapshots, cursor);
    if (!snapshot) {
      return {
        available: false,
        reason: "schedule_unavailable",
        startDate: window.startDate,
        endDate: window.endDate,
        eligibleFrom: startDate,
        dueThrough,
        plannedDays: 0,
        completedDays: 0,
        consistencyPct: null,
        dayResults: [],
      };
    }

    const result = consistencyPlannedDayCompleted({
      dateYmd: cursor,
      schedule: snapshot.schedule,
      log: logByDate.get(cursor) || null,
    });
    dayResults.push({
      dateYmd: cursor,
      scheduleEffectiveDate: snapshot.effectiveDate,
      ...result,
    });
    cursor = shiftConsistencyYmd(cursor, 1);
  }

  const plannedDays = dayResults.filter((day) => day.planned).length;
  const completedDays = dayResults.filter((day) => day.planned && day.completed).length;
  const consistencyPct = plannedDays
    ? Math.round((completedDays / plannedDays) * 1000) / 10
    : null;

  return {
    available: true,
    reason: plannedDays ? "scored" : "no_planned_days",
    startDate: window.startDate,
    endDate: window.endDate,
    eligibleFrom: startDate,
    dueThrough,
    plannedDays,
    completedDays,
    consistencyPct,
    dayResults,
  };
}

export function rankConsistencyRows(rows = []) {
  const ordered = [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const aScored = Number.isFinite(Number(a?.consistencyPct)) && Number(a?.plannedDays) > 0;
    const bScored = Number.isFinite(Number(b?.consistencyPct)) && Number(b?.plannedDays) > 0;
    if (aScored !== bScored) return aScored ? -1 : 1;
    if (aScored && bScored) {
      const scoreDiff = Number(b.consistencyPct) - Number(a.consistencyPct);
      if (scoreDiff) return scoreDiff;
    }
    return cleanText(a?.nickname).localeCompare(cleanText(b?.nickname), "en", { sensitivity: "base" });
  });

  let lastPct = null;
  let lastRank = 0;
  return ordered.map((row, index) => {
    const scored = Number.isFinite(Number(row?.consistencyPct)) && Number(row?.plannedDays) > 0;
    if (!scored) return { ...row, rank: null };
    const pct = Number(row.consistencyPct);
    if (lastPct === null || pct !== lastPct) lastRank = index + 1;
    lastPct = pct;
    return { ...row, rank: lastRank };
  });
}
