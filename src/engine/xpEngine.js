import { BADGE_DEFS } from "../config/badges.js";

export const XP_ENGINE_SCORE_VERSION = 1;
export const SESSION_COMPLETION_XP = 10;

export const XP_RULES = Object.freeze({
  strengthSet: 2,
  cardioPerMin: 1 / 2,
  cardioPerKm: 1 / 0.5,
  durationPerMin: 2 / 10,
  sessionComplete: SESSION_COMPLETION_XP,
  taskDefault: 5,
  blockComplete: 5,
  progression: 10,
  cardioProgression: 20,
  dayCompleteBonus: 10,
  streak: Object.freeze({
    1: 0,
    2: 5,
    3: 10,
    5: 20,
    10: 50,
    30: 100,
    60: 200,
    90: 300,
    180: 600,
  }),
});

const CARDIO_MODE = Object.freeze({ PROGRESSIVE: "progressive", CASUAL: "casual" });
const CARDIO_MODE_MULTIPLIER = Object.freeze({ progressive: 1, casual: 0.6 });
const SPORT_AVATAR_XP_BY_TIER = Object.freeze({
  bronze: 25,
  silver: 35,
  gold: 50,
  platinum: 70,
  diamond: 95,
  elite: 125,
  champion: 160,
  unreal: 200,
});

export function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function setDidSomething(set) {
  if (!set || typeof set !== "object") return false;
  return (
    safeNumber(set.reps) > 0 ||
    safeNumber(set.timeSeconds) > 0 ||
    safeNumber(set.count) > 0 ||
    safeNumber(set.distanceKm) > 0 ||
    safeNumber(set.durationMin) > 0
  );
}

function setVolume(set) {
  if (!set || typeof set !== "object") return 0;
  return safeNumber(set.reps) * safeNumber(set.weight);
}

export function scoreSets(sets) {
  if (!Array.isArray(sets)) return 0;
  let score = 0;
  for (const set of sets) {
    if (!set || typeof set !== "object") continue;
    score += setVolume(set);
    score += safeNumber(set.reps) * 0.5;
    score += safeNumber(set.timeSeconds) * 0.1;
    score += safeNumber(set.count) * 0.5;
    score += safeNumber(set.distanceKm) * 10;
    score += safeNumber(set.durationMin);
  }
  return score;
}

function logDate(row) {
  return String(row?.date_ymd || row?.date || "");
}

function logPayload(row) {
  return row?.log || row?.log_json || null;
}

export function normaliseXpRecords(records) {
  return (Array.isArray(records) ? records : [])
    .map((row) => ({ ...row, date_ymd: logDate(row), log: logPayload(row) }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date_ymd) && row.log)
    .sort((a, b) => a.date_ymd.localeCompare(b.date_ymd));
}

function sessionBlockIsComplete(block) {
  if (!block || String(block.typeId || "").toLowerCase() !== "session" || block.cancelled) return false;
  const session = block.session && typeof block.session === "object" ? block.session : block;
  return !!session?.completed;
}

export function isDayGreenForXp(log) {
  if (!log || !Array.isArray(log.blocks) || !log.blocks.length) return false;
  let any = false;

  for (const block of log.blocks) {
    if (!block || block.cancelled) continue;
    const typeId = String(block.typeId || "").toLowerCase();
    if (typeId === "tasks") continue;

    let hasData = false;
    if (typeId === "strength" || typeId === "hiit" || typeId === "box") {
      hasData = !!(
        block.sets &&
        Object.values(block.sets).some(
          (arr) => Array.isArray(arr) && arr.some((set) => set && setDidSomething(set))
        )
      );
    } else if (typeId === "cardio") {
      hasData = safeNumber(block?.cardio?.distanceKm) > 0 || safeNumber(block?.cardio?.durationMin) > 0;
    } else if (typeId === "duration") {
      hasData = safeNumber(block?.duration?.minutes) > 0;
    } else if (typeId === "session") {
      hasData = sessionBlockIsComplete(block);
    } else if (typeId === "recovery") {
      hasData = !!block?.recoveryDone;
    }

    if (!hasData) return false;
    any = true;
  }

  return any;
}

function countCompletedSetsInBlock(block) {
  if (!block || !block.sets || typeof block.sets !== "object") return 0;
  let count = 0;
  for (const movementId of Object.keys(block.sets)) {
    const arr = Array.isArray(block.sets[movementId]) ? block.sets[movementId] : [];
    count += arr.filter(setDidSomething).length;
  }
  return count;
}

function xpForStrengthBlock(block) {
  const sets = countCompletedSetsInBlock(block);
  return sets > 0 ? sets * XP_RULES.strengthSet : 0;
}

function xpForCardioBlock(block) {
  const km = safeNumber(block?.cardio?.distanceKm);
  const min = safeNumber(block?.cardio?.durationMin);
  if (!km && !min) return 0;
  const xpByMin = min > 0 ? Math.ceil(min * XP_RULES.cardioPerMin) : 0;
  const xpByKm = km > 0 ? Math.ceil(km * XP_RULES.cardioPerKm) : 0;
  return xpByMin + xpByKm;
}

function xpForDurationBlock(block) {
  const mins = safeNumber(block?.duration?.minutes);
  return mins > 0 ? Math.ceil(mins * XP_RULES.durationPerMin) : 0;
}

function xpForRecoveryBlock(block) {
  return block?.recoveryDone ? 5 : 0;
}

function findPlanBlockForLogBlock(plan, logBlockId) {
  if (!plan || !plan.blocksByWeekday) return null;
  for (const weekday of Object.keys(plan.blocksByWeekday)) {
    const arr = plan.blocksByWeekday[weekday] || [];
    for (const block of arr) if (block && block.id === logBlockId) return block;
  }
  return null;
}

function xpForTasksBlock(block, plan) {
  const done = block?.tasksDone || {};
  const doneIds = Object.entries(done).filter(([, value]) => !!value).map(([id]) => id);
  if (!doneIds.length) return 0;

  let total = 0;
  const planBlock = findPlanBlockForLogBlock(plan, block?.id);
  if (planBlock && Array.isArray(planBlock.tasks)) {
    const taskMap = new Map(planBlock.tasks.filter((task) => task?.id).map((task) => [task.id, task]));
    for (const id of doneIds) {
      const xpValue = safeNumber(taskMap.get(id)?.xpValue);
      total += xpValue > 0 ? xpValue : XP_RULES.taskDefault;
    }
  } else {
    total = doneIds.length * XP_RULES.taskDefault;
  }
  return total;
}

function findLastMovementSets(records, movementId, beforeYmd) {
  for (let i = records.length - 1; i >= 0; i -= 1) {
    const row = records[i];
    if (!row?.date_ymd || row.date_ymd >= beforeYmd) continue;
    const log = row?.log;
    if (!log) continue;

    const legacySets = log?.entries?.[movementId] || null;
    if (Array.isArray(legacySets) && legacySets.some(setDidSomething)) return legacySets;

    for (const block of Array.isArray(log.blocks) ? log.blocks : []) {
      const setsByMovement = block?.sets && typeof block.sets === "object" ? block.sets : null;
      const blockSets = setsByMovement?.[movementId];
      if (Array.isArray(blockSets) && blockSets.some(setDidSomething)) return blockSets;
    }
  }
  return null;
}

function findLastCardio(records, beforeYmd) {
  for (let i = records.length - 1; i >= 0; i -= 1) {
    const row = records[i];
    if (!row?.date_ymd || row.date_ymd >= beforeYmd) continue;
    const log = row?.log;
    if (!log) continue;

    if (Array.isArray(log.blocks) && log.blocks.length) {
      let totalDist = 0;
      let totalMin = 0;
      for (const block of log.blocks) {
        if (!block?.cardio) continue;
        totalDist += safeNumber(block.cardio.distanceKm);
        totalMin += safeNumber(block.cardio.durationMin);
      }
      if (totalDist > 0 || totalMin > 0) {
        return {
          distanceKm: totalDist,
          durationMin: totalMin,
          avgSpeedKmh:
            totalDist > 0 && totalMin > 0
              ? totalDist / (totalMin || 1)
              : safeNumber(log.cardio?.avgSpeedKmh),
        };
      }
    }

    const legacy = log.cardio;
    if (legacy && (safeNumber(legacy.distanceKm) > 0 || safeNumber(legacy.durationMin) > 0)) {
      return {
        distanceKm: safeNumber(legacy.distanceKm),
        durationMin: safeNumber(legacy.durationMin),
        avgSpeedKmh: safeNumber(legacy.avgSpeedKmh),
      };
    }
  }
  return null;
}

function isCardioImproved(current, last) {
  if (!current || !last) return false;
  const curD = safeNumber(current.distanceKm);
  const curT = safeNumber(current.durationMin);
  const lastD = safeNumber(last.distanceKm);
  const lastT = safeNumber(last.durationMin);
  if (curD && curT && lastD && lastT) return curD / curT > lastD / lastT + 0.01;
  if (curD && lastD) return curD > lastD + 0.05;
  if (curT && lastT) return curT > lastT + 1;
  return false;
}

function normaliseClaimedRewards(meta) {
  const raw = Array.isArray(meta?.claimedRewards) ? meta.claimedRewards : [];
  const out = [];
  for (const item of raw) {
    if (!item) continue;
    if (typeof item === "string") out.push({ key: item, claimedAtYmd: null });
    else if (typeof item === "object" && typeof item.key === "string") {
      out.push({ key: item.key, claimedAtYmd: typeof item.claimedAtYmd === "string" ? item.claimedAtYmd : null });
    }
  }
  return out;
}

function getSportAvatarXpForKey(key) {
  if (typeof key !== "string" || !key.startsWith("sport_avatar_")) return 0;
  for (const [tier, xp] of Object.entries(SPORT_AVATAR_XP_BY_TIER)) {
    if (key.endsWith(`_${tier}`)) return xp;
  }
  return 0;
}

export function getRewardXpForKey(key) {
  const badge = BADGE_DEFS.find((definition) => definition.key === key);
  return badge ? safeNumber(badge.xp) : getSportAvatarXpForKey(key);
}

function computeClaimedRewardsXpByDate(plan) {
  const map = {};
  for (const claim of normaliseClaimedRewards(plan?.meta)) {
    if (!claim?.claimedAtYmd) continue;
    const xp = getRewardXpForKey(claim.key);
    if (xp) map[claim.claimedAtYmd] = (map[claim.claimedAtYmd] || 0) + xp;
  }
  return map;
}

function computeStreakBonusMap(records) {
  const completeDates = records
    .filter((row) => isDayGreenForXp(row.log) || !!row.log?.meta?.streakSaved)
    .map((row) => row.date_ymd)
    .sort();
  if (!completeDates.length) return {};

  const bonusByDate = {};
  let streak = 0;
  let prevDate = "";
  for (const date of completeDates) {
    if (!prevDate) streak = 1;
    else {
      const prev = new Date(`${prevDate}T00:00:00Z`);
      const cur = new Date(`${date}T00:00:00Z`);
      streak = Math.round((cur - prev) / 86400000) === 1 ? streak + 1 : 1;
    }
    const bonus = XP_RULES.streak[streak] || 0;
    if (bonus > 0) bonusByDate[date] = bonus;
    prevDate = date;
  }
  return bonusByDate;
}

export function buildXpDebugRows(inputRecords, plan) {
  const records = normaliseXpRecords(inputRecords);
  if (!records.length) return [];

  const streakXpByDate = computeStreakBonusMap(records);
  const claimedBadgeXpByDate = computeClaimedRewardsXpByDate(plan);
  const rows = [];

  for (const row of records) {
    const date = row.date_ymd;
    const log = row.log;
    const weekday = log.weekday || new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
    const complete = isDayGreenForXp(log);
    const blocks = Array.isArray(log.blocks) ? log.blocks : [];

    let setsLogged = 0;
    let cardioKm = 0;
    let customMin = 0;
    let tasksDone = 0;
    let anyCardio = false;
    let allCardioAreWalk = true;
    let cardioMode = CARDIO_MODE.PROGRESSIVE;
    let setsXp = 0;
    const movementsXp = 0;

    let strengthXp = 0;
    let cardioXp = 0;
    let durationXp = 0;
    let sessionXp = 0;
    let recoveryXp = 0;
    let tasksXp = 0;
    let dayCompleteXp = 0;
    let strengthProgressXp = 0;
    let cardioProgressXp = 0;
    let progressCount = 0;

    for (const block of blocks) {
      if (!block) continue;
      switch (block.typeId) {
        case "strength":
        case "hiit":
        case "box": {
          const setsByMovement = block.sets && typeof block.sets === "object" ? block.sets : {};
          const movements = Array.isArray(block.movements) ? block.movements : [];
          for (const movement of movements) {
            const movementSets = Array.isArray(setsByMovement[movement.id]) ? setsByMovement[movement.id] : [];
            const completedSets = movementSets.filter(setDidSomething);
            if (!completedSets.length) continue;
            setsLogged += completedSets.length;
            const lastSets = findLastMovementSets(records, movement.id, date);
            const lastScore = scoreSets(lastSets || []);
            const curScore = scoreSets(movementSets);
            if (curScore > lastScore && lastScore > 0) progressCount += 1;
          }
          const blockXp = xpForStrengthBlock(block);
          strengthXp += blockXp;
          setsXp += blockXp;
          if (blockXp > 0) strengthXp += XP_RULES.blockComplete;
          break;
        }
        case "cardio": {
          const cardio = block.cardio || {};
          anyCardio = true;
          if ((block.cardioType || "run") !== "walk") allCardioAreWalk = false;
          const km = safeNumber(cardio.distanceKm);
          const min = safeNumber(cardio.durationMin);
          cardioKm += km;
          customMin += min;
          const blockXp = xpForCardioBlock(block);
          cardioXp += blockXp;
          if (blockXp > 0) cardioXp += XP_RULES.blockComplete;
          break;
        }
        case "duration": {
          customMin += safeNumber(block?.duration?.minutes);
          const blockXp = xpForDurationBlock(block);
          durationXp += blockXp;
          if (blockXp > 0) durationXp += XP_RULES.blockComplete;
          break;
        }
        case "session":
          sessionXp += sessionBlockIsComplete(block) ? XP_RULES.sessionComplete : 0;
          break;
        case "recovery":
          recoveryXp += xpForRecoveryBlock(block);
          break;
        case "tasks": {
          tasksDone += Object.values(block.tasksDone || {}).filter(Boolean).length;
          tasksXp += xpForTasksBlock(block, plan);
          break;
        }
        default:
          break;
      }
    }

    if (progressCount > 0) strengthProgressXp = progressCount * XP_RULES.progression;

    if (cardioKm > 0 || customMin > 0) {
      const effectiveCardio = {
        distanceKm: cardioKm,
        durationMin: customMin,
        avgSpeedKmh:
          cardioKm > 0 && customMin > 0
            ? cardioKm / (customMin || 1)
            : safeNumber(log.cardio?.avgSpeedKmh),
      };
      const lastCardio = findLastCardio(records, date);
      if (lastCardio && isCardioImproved(effectiveCardio, lastCardio)) {
        cardioProgressXp = XP_RULES.cardioProgression;
      }
    }

    if (anyCardio) {
      cardioMode = allCardioAreWalk ? CARDIO_MODE.CASUAL : CARDIO_MODE.PROGRESSIVE;
      cardioXp = Math.round(cardioXp * (CARDIO_MODE_MULTIPLIER[cardioMode] || 1));
    }

    dayCompleteXp = complete ? XP_RULES.dayCompleteBonus : 0;
    const streakXp = streakXpByDate[date] || 0;
    const badgeClaimXp = claimedBadgeXpByDate[date] || 0;
    const dailyBonusXp = log?.meta?.challengeClaimed ? 15 : 0;
    const nonBonusXp = strengthXp + cardioXp + durationXp + sessionXp + recoveryXp + tasksXp + dayCompleteXp;
    const progXp = strengthProgressXp + cardioProgressXp;
    const totalXp = nonBonusXp + progXp + streakXp + dailyBonusXp + badgeClaimXp;

    rows.push({
      date,
      weekday,
      kind: "blocks",
      complete,
      totalXp,
      nonBonusXp,
      strengthXp,
      cardioXp,
      durationXp,
      sessionXp,
      recoveryXp,
      tasksXp,
      dayCompleteXp,
      dailyBonusXp,
      strengthProgressXp,
      cardioProgressXp,
      progXp,
      streakXp,
      badgeClaimXp,
      baseXp: nonBonusXp,
      progressXp: strengthProgressXp,
      extraXp: cardioXp,
      bonus: dayCompleteXp,
      oneOffDone: false,
      oneOffXp: 0,
      setsXp,
      movementsXp,
      tasksDone,
      tasksXp_legacy: 0,
      cardioMode: anyCardio ? cardioMode : null,
      setsLogged,
      cardioKm,
      customMin,
    });
  }

  const existingDates = new Set(rows.map((row) => row.date));
  for (const [date, xp] of Object.entries(claimedBadgeXpByDate)) {
    if (!xp || existingDates.has(date)) continue;
    rows.push({
      date,
      weekday: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
      kind: "badge_claim",
      complete: false,
      totalXp: xp,
      nonBonusXp: 0,
      strengthXp: 0,
      cardioXp: 0,
      durationXp: 0,
      sessionXp: 0,
      recoveryXp: 0,
      tasksXp: 0,
      dayCompleteXp: 0,
      dailyBonusXp: 0,
      strengthProgressXp: 0,
      cardioProgressXp: 0,
      progXp: 0,
      streakXp: 0,
      badgeClaimXp: xp,
      baseXp: 0,
      progressXp: 0,
      extraXp: xp,
      bonus: 0,
      oneOffDone: false,
      oneOffXp: 0,
      setsXp: 0,
      movementsXp: 0,
      tasksDone: 0,
      tasksXp_legacy: 0,
      setsLogged: 0,
      cardioKm: 0,
      customMin: 0,
      cardioMode: null,
    });
  }

  rows.sort((a, b) => b.date.localeCompare(a.date));
  let running = rows.reduce((sum, row) => sum + safeNumber(row.totalXp), 0);
  for (const row of rows) {
    row.runningTotalXp = running;
    running -= safeNumber(row.totalXp);
  }
  return rows;
}

export function computeXpFromLogs(records, plan) {
  return buildXpDebugRows(records, plan).reduce((sum, row) => sum + safeNumber(row.totalXp), 0);
}

function parseYmd(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ""))) return null;
  const date = new Date(`${ymd}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function shiftYmd(ymd, days) {
  const date = parseYmd(ymd);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

export function getWeekStartYmd(referenceYmd) {
  const date = parseYmd(referenceYmd);
  if (!date) return "";
  const diffToMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diffToMonday);
  return date.toISOString().slice(0, 10);
}

export function buildCompetitionWindow(startDate, endDate, extra = {}) {
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  if (!start || !end || start > end) throw new Error("Invalid competition window");
  return { startDate, endDate, ...extra };
}

export function getCurrentWeekWindow(referenceYmd) {
  const startDate = getWeekStartYmd(referenceYmd);
  if (!startDate) return null;
  return buildCompetitionWindow(startDate, shiftYmd(startDate, 6), { key: startDate, complete: false });
}

export function getPreviousCompletedWeekWindows(referenceYmd, count = 4) {
  const currentStart = getWeekStartYmd(referenceYmd);
  if (!currentStart) return [];
  const size = Math.max(0, Math.min(12, Number(count) || 0));
  return Array.from({ length: size }, (_, index) => {
    const startDate = shiftYmd(currentStart, -7 * (index + 1));
    return buildCompetitionWindow(startDate, shiftYmd(startDate, 6), { key: startDate, complete: true });
  });
}

export function sumXpRowsInRange(rows, startDate, endDate, eligibleFrom = "") {
  const effectiveStart = eligibleFrom && eligibleFrom > startDate ? eligibleFrom : startDate;
  if (effectiveStart > endDate) return 0;
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
    const date = String(row?.date || "");
    return date >= effectiveStart && date <= endDate ? sum + safeNumber(row.totalXp) : sum;
  }, 0);
}

export function computeXpForWindow(records, plan, window, { eligibleFrom = "" } = {}) {
  const rows = buildXpDebugRows(records, plan);
  return {
    xp: sumXpRowsInRange(rows, window.startDate, window.endDate, eligibleFrom),
    startDate: window.startDate,
    endDate: window.endDate,
    eligibleFrom: eligibleFrom || window.startDate,
    scoreVersion: XP_ENGINE_SCORE_VERSION,
  };
}
