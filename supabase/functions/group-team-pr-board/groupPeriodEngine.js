export const GROUP_PERIOD_SCORE_VERSION = 1;
export const GROUP_SEASON_WEEKS = 8;
export const GROUP_SEASON_DAYS = GROUP_SEASON_WEEKS * 7;

function cleanText(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function finiteNullable(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseYmd(value) {
  const text = cleanText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(startYmd, endYmd) {
  const start = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  if (!start || !end) return null;
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

export function shiftGroupPeriodYmd(value, days) {
  const date = parseYmd(value);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

export function getGroupMonthWindow(referenceYmd) {
  const date = parseYmd(referenceYmd);
  if (!date) return null;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    key: start.toISOString().slice(0, 7),
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    complete: false,
  };
}

export function getPreviousCompletedGroupMonthWindows(referenceYmd, count = 3) {
  const date = parseYmd(referenceYmd);
  if (!date) return [];
  const size = Math.max(0, Math.min(24, Number(count) || 0));
  return Array.from({ length: size }, (_, index) => {
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - index, 0));
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    return {
      key: start.toISOString().slice(0, 7),
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      complete: true,
    };
  });
}

export function getGroupSeasonAnchorYmd(competitionStartYmd) {
  const date = parseYmd(competitionStartYmd);
  if (!date) return "";
  const diffToMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diffToMonday);
  return date.toISOString().slice(0, 10);
}

export function getCurrentGroupSeasonWindow(competitionStartYmd, referenceYmd) {
  const anchor = getGroupSeasonAnchorYmd(competitionStartYmd);
  const reference = parseYmd(referenceYmd);
  if (!anchor || !reference) return null;
  const elapsed = daysBetween(anchor, referenceYmd);
  const seasonIndex = Math.max(0, Math.floor(Math.max(0, elapsed || 0) / GROUP_SEASON_DAYS));
  const startDate = shiftGroupPeriodYmd(anchor, seasonIndex * GROUP_SEASON_DAYS);
  const endDate = shiftGroupPeriodYmd(startDate, GROUP_SEASON_DAYS - 1);
  const dayIntoSeason = Math.max(0, Math.min(GROUP_SEASON_DAYS - 1, daysBetween(startDate, referenceYmd) || 0));
  return {
    key: `season-${seasonIndex + 1}`,
    seasonNumber: seasonIndex + 1,
    startDate,
    endDate,
    weekNumber: Math.floor(dayIntoSeason / 7) + 1,
    complete: false,
  };
}

export function getPreviousCompletedGroupSeasonWindows(competitionStartYmd, referenceYmd, count = 2) {
  const current = getCurrentGroupSeasonWindow(competitionStartYmd, referenceYmd);
  if (!current) return [];
  const size = Math.max(0, Math.min(12, Number(count) || 0));
  return Array.from({ length: size }, (_, index) => {
    const seasonNumber = current.seasonNumber - index - 1;
    if (seasonNumber < 1) return null;
    const startDate = shiftGroupPeriodYmd(current.startDate, -GROUP_SEASON_DAYS * (index + 1));
    return {
      key: `season-${seasonNumber}`,
      seasonNumber,
      startDate,
      endDate: shiftGroupPeriodYmd(startDate, GROUP_SEASON_DAYS - 1),
      weekNumber: GROUP_SEASON_WEEKS,
      complete: true,
    };
  }).filter(Boolean);
}

function metricState(row, metric) {
  if (metric === "xp") {
    const value = finiteNullable(row?.xp);
    return { scored: value !== null, value };
  }
  if (metric === "consistency") {
    const value = finiteNullable(row?.consistencyPct);
    return { scored: value !== null && Number(row?.plannedDays || 0) > 0, value };
  }
  if (metric === "improvement") {
    const value = finiteNullable(row?.improvementPct);
    return { scored: value !== null && Number(row?.improvementMetricCount || row?.metricCount || 0) > 0, value };
  }
  return { scored: false, value: null };
}

export function rankGroupPeriodMetric(rows = [], metric = "xp") {
  const ordered = [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const aState = metricState(a, metric);
    const bState = metricState(b, metric);
    if (aState.scored !== bState.scored) return aState.scored ? -1 : 1;
    if (aState.scored && bState.scored && aState.value !== bState.value) return bState.value - aState.value;
    return cleanText(a?.nickname).localeCompare(cleanText(b?.nickname), "en", { sensitivity: "base" });
  });

  let lastScore = null;
  let lastRank = 0;
  return ordered.map((row, index) => {
    const state = metricState(row, metric);
    if (!state.scored) return { ...row, rank: null };
    if (lastScore === null || state.value !== lastScore) lastRank = index + 1;
    lastScore = state.value;
    return { ...row, rank: lastRank };
  });
}

export function addGroupPeriodRanks(rows = []) {
  const base = Array.isArray(rows) ? rows : [];
  const xpById = new Map(rankGroupPeriodMetric(base, "xp").map((row) => [row.membership_id, row.rank]));
  const consistencyById = new Map(rankGroupPeriodMetric(base, "consistency").map((row) => [row.membership_id, row.rank]));
  const improvementById = new Map(rankGroupPeriodMetric(base, "improvement").map((row) => [row.membership_id, row.rank]));
  return base.map((row) => ({
    ...row,
    xpRank: xpById.get(row.membership_id) ?? null,
    consistencyRank: consistencyById.get(row.membership_id) ?? null,
    improvementRank: improvementById.get(row.membership_id) ?? null,
  }));
}

function participated(row) {
  return Number(row?.xp || 0) > 0 || Number(row?.completedDays || 0) > 0 || Number(row?.improvementMetricCount || row?.metricCount || 0) > 0;
}

function winnerRows(rows, rankKey, valueKey, predicate = () => true) {
  return rows.filter((row) => row?.[rankKey] === 1 && predicate(row)).map((row) => ({ row, value: finiteNullable(row?.[valueKey]) }));
}

export function buildGroupProgressAwards({ periodType, periodStart, periodEnd, seasonNumber = null, state, rows = [] } = {}) {
  if (state !== "frozen" || !["month", "season"].includes(periodType) || !parseYmd(periodStart) || !parseYmd(periodEnd)) return [];
  const ranked = addGroupPeriodRanks(rows);
  const awards = [];
  const addWinnerAwards = (type, rankKey, valueKey, unit, predicate) => {
    for (const winner of winnerRows(ranked, rankKey, valueKey, predicate)) {
      awards.push({
        membership_id: winner.row.membership_id,
        awardType: type,
        periodType,
        periodStart,
        periodEnd,
        seasonNumber,
        rank: 1,
        scoreValue: winner.value,
        scoreUnit: unit,
        nickname: winner.row.nickname,
        avatar_id: winner.row.avatar_id || "",
        avatar_frame: winner.row.avatar_frame || "",
        avatar_frames_enabled: winner.row.avatar_frames_enabled !== false,
      });
    }
  };

  const prefix = periodType === "month" ? "monthly" : "season";
  addWinnerAwards(`${prefix}_xp`, "xpRank", "xp", "xp", (row) => Number(row?.xp || 0) > 0);
  addWinnerAwards(`${prefix}_consistency`, "consistencyRank", "consistencyPct", "pct", (row) => Number(row?.plannedDays || 0) > 0);
  addWinnerAwards(`${prefix}_improvement`, "improvementRank", "improvementPct", "pct", (row) => Number(row?.improvementMetricCount || row?.metricCount || 0) > 0);

  if (periodType === "season") {
    for (const row of ranked.filter(participated)) {
      awards.push({
        membership_id: row.membership_id,
        awardType: "season_finisher",
        periodType,
        periodStart,
        periodEnd,
        seasonNumber,
        rank: null,
        scoreValue: null,
        scoreUnit: "participation",
        nickname: row.nickname,
        avatar_id: row.avatar_id || "",
        avatar_frame: row.avatar_frame || "",
        avatar_frames_enabled: row.avatar_frames_enabled !== false,
      });
    }
  }

  return awards;
}
