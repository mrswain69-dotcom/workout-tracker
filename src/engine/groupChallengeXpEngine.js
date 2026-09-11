export const GROUP_CHALLENGE_XP_SCORE_VERSION = 1;

const XP_RULES = Object.freeze({
  strengthSet: 2,
  cardioPerMin: 1 / 2,
  cardioPerKm: 1 / 0.5,
  durationPerMin: 2 / 10,
  sessionComplete: 10,
  taskDefault: 5,
  blockComplete: 5,
  progression: 10,
  cardioProgression: 20,
  dayCompleteBonus: 10,
  streak: Object.freeze({ 1: 0, 2: 5, 3: 10, 5: 20, 10: 50, 30: 100, 60: 200, 90: 300, 180: 600 }),
});

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function setDidSomething(set) {
  if (!set || typeof set !== "object") return false;
  return safeNumber(set.reps) > 0
    || safeNumber(set.timeSeconds) > 0
    || safeNumber(set.count) > 0
    || safeNumber(set.distanceKm) > 0
    || safeNumber(set.durationMin) > 0;
}

function logDate(row) {
  return String(row?.date_ymd || row?.date || "");
}

function logPayload(row) {
  return row?.log || row?.log_json || null;
}

function normaliseRecords(records) {
  return (Array.isArray(records) ? records : [])
    .map((row) => ({ date_ymd: logDate(row), log: logPayload(row) }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date_ymd) && row.log)
    .sort((a, b) => a.date_ymd.localeCompare(b.date_ymd));
}

function sessionComplete(block) {
  if (!block || String(block.typeId || "").toLowerCase() !== "session" || block.cancelled) return false;
  const session = block.session && typeof block.session === "object" ? block.session : block;
  return !!session.completed;
}

function dayGreen(log) {
  if (!log || !Array.isArray(log.blocks) || !log.blocks.length) return false;
  let any = false;
  for (const block of log.blocks) {
    if (!block || block.cancelled) continue;
    const typeId = String(block.typeId || "").toLowerCase();
    if (typeId === "tasks") continue;
    let complete = false;
    if (["strength", "hiit", "box"].includes(typeId)) {
      complete = !!(block.sets && Object.values(block.sets).some((sets) => Array.isArray(sets) && sets.some(setDidSomething)));
    } else if (typeId === "cardio") {
      complete = safeNumber(block?.cardio?.distanceKm) > 0 || safeNumber(block?.cardio?.durationMin) > 0;
    } else if (typeId === "duration") {
      complete = safeNumber(block?.duration?.minutes) > 0;
    } else if (typeId === "session") {
      complete = sessionComplete(block);
    } else if (typeId === "recovery") {
      complete = !!block.recoveryDone;
    }
    if (!complete) return false;
    any = true;
  }
  return any;
}

function scoreSets(sets) {
  return (Array.isArray(sets) ? sets : []).reduce((score, set) => {
    if (!set || typeof set !== "object") return score;
    return score
      + safeNumber(set.reps) * safeNumber(set.weight)
      + safeNumber(set.reps) * 0.5
      + safeNumber(set.timeSeconds) * 0.1
      + safeNumber(set.count) * 0.5
      + safeNumber(set.distanceKm) * 10
      + safeNumber(set.durationMin);
  }, 0);
}

function findLastMovementSets(records, movementId, beforeYmd) {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const row = records[index];
    if (row.date_ymd >= beforeYmd) continue;
    const legacy = row.log?.entries?.[movementId];
    if (Array.isArray(legacy) && legacy.some(setDidSomething)) return legacy;
    for (const block of Array.isArray(row.log?.blocks) ? row.log.blocks : []) {
      const sets = block?.sets?.[movementId];
      if (Array.isArray(sets) && sets.some(setDidSomething)) return sets;
    }
  }
  return null;
}

function findLastCardio(records, beforeYmd) {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const row = records[index];
    if (row.date_ymd >= beforeYmd) continue;
    let distanceKm = 0;
    let durationMin = 0;
    for (const block of Array.isArray(row.log?.blocks) ? row.log.blocks : []) {
      if (!block?.cardio) continue;
      distanceKm += safeNumber(block.cardio.distanceKm);
      durationMin += safeNumber(block.cardio.durationMin);
    }
    if (distanceKm > 0 || durationMin > 0) return { distanceKm, durationMin };
    const legacy = row.log?.cardio;
    if (legacy && (safeNumber(legacy.distanceKm) > 0 || safeNumber(legacy.durationMin) > 0)) {
      return { distanceKm: safeNumber(legacy.distanceKm), durationMin: safeNumber(legacy.durationMin) };
    }
  }
  return null;
}

function cardioImproved(current, previous) {
  if (!current || !previous) return false;
  const curD = safeNumber(current.distanceKm);
  const curT = safeNumber(current.durationMin);
  const prevD = safeNumber(previous.distanceKm);
  const prevT = safeNumber(previous.durationMin);
  if (curD && curT && prevD && prevT) return curD / curT > prevD / prevT + 0.01;
  if (curD && prevD) return curD > prevD + 0.05;
  if (curT && prevT) return curT > prevT + 1;
  return false;
}

function planBlock(plan, id) {
  for (const blocks of Object.values(plan?.blocksByWeekday || {})) {
    const found = (Array.isArray(blocks) ? blocks : []).find((block) => block?.id === id);
    if (found) return found;
  }
  return null;
}

function tasksXp(block, plan) {
  const doneIds = Object.entries(block?.tasksDone || {}).filter(([, done]) => !!done).map(([id]) => id);
  if (!doneIds.length) return 0;
  const planned = planBlock(plan, block?.id);
  if (!planned || !Array.isArray(planned.tasks)) return doneIds.length * XP_RULES.taskDefault;
  const byId = new Map(planned.tasks.filter((task) => task?.id).map((task) => [task.id, task]));
  return doneIds.reduce((sum, id) => {
    const value = safeNumber(byId.get(id)?.xpValue);
    return sum + (value > 0 ? value : XP_RULES.taskDefault);
  }, 0);
}

function streakMap(records) {
  const dates = records
    .filter((row) => dayGreen(row.log) || !!row.log?.meta?.streakSaved)
    .map((row) => row.date_ymd)
    .sort();
  const map = {};
  let streak = 0;
  let previous = "";
  for (const date of dates) {
    if (!previous) streak = 1;
    else {
      const gap = Math.round((new Date(`${date}T00:00:00Z`) - new Date(`${previous}T00:00:00Z`)) / 86400000);
      streak = gap === 1 ? streak + 1 : 1;
    }
    map[date] = XP_RULES.streak[streak] || 0;
    previous = date;
  }
  return map;
}

export function buildGroupChallengeTrainingXpRows(inputRecords = [], plan = {}) {
  const records = normaliseRecords(inputRecords);
  const streakXp = streakMap(records);
  const rows = [];

  for (const row of records) {
    const log = row.log;
    const date = row.date_ymd;
    let strengthXp = 0;
    let cardioXp = 0;
    let durationXp = 0;
    let sessionXp = 0;
    let recoveryXp = 0;
    let taskXp = 0;
    let progressCount = 0;
    let cardioKm = 0;
    let cardioMin = 0;
    let anyCardio = false;
    let allCardioWalk = true;

    for (const block of Array.isArray(log?.blocks) ? log.blocks : []) {
      if (!block) continue;
      const typeId = String(block.typeId || "").toLowerCase();
      if (["strength", "hiit", "box"].includes(typeId)) {
        let setCount = 0;
        const setsByMovement = block.sets && typeof block.sets === "object" ? block.sets : {};
        for (const movement of Array.isArray(block.movements) ? block.movements : []) {
          const sets = Array.isArray(setsByMovement[movement.id]) ? setsByMovement[movement.id] : [];
          const completed = sets.filter(setDidSomething);
          setCount += completed.length;
          if (completed.length) {
            const previous = findLastMovementSets(records, movement.id, date);
            const previousScore = scoreSets(previous || []);
            if (previousScore > 0 && scoreSets(sets) > previousScore) progressCount += 1;
          }
        }
        if (setCount > 0) strengthXp += setCount * XP_RULES.strengthSet + XP_RULES.blockComplete;
      } else if (typeId === "cardio") {
        anyCardio = true;
        if ((block.cardioType || "run") !== "walk") allCardioWalk = false;
        const km = safeNumber(block?.cardio?.distanceKm);
        const min = safeNumber(block?.cardio?.durationMin);
        cardioKm += km;
        cardioMin += min;
        if (km > 0 || min > 0) {
          cardioXp += (min > 0 ? Math.ceil(min * XP_RULES.cardioPerMin) : 0)
            + (km > 0 ? Math.ceil(km * XP_RULES.cardioPerKm) : 0)
            + XP_RULES.blockComplete;
        }
      } else if (typeId === "duration") {
        const min = safeNumber(block?.duration?.minutes);
        if (min > 0) durationXp += Math.ceil(min * XP_RULES.durationPerMin) + XP_RULES.blockComplete;
      } else if (typeId === "session") {
        if (sessionComplete(block)) sessionXp += XP_RULES.sessionComplete;
      } else if (typeId === "recovery") {
        if (block.recoveryDone) recoveryXp += 5;
      } else if (typeId === "tasks") {
        taskXp += tasksXp(block, plan);
      }
    }

    if (anyCardio && allCardioWalk) cardioXp = Math.round(cardioXp * 0.6);
    const strengthProgressXp = progressCount * XP_RULES.progression;
    const previousCardio = findLastCardio(records, date);
    const cardioProgressXp = previousCardio && cardioImproved({ distanceKm: cardioKm, durationMin: cardioMin }, previousCardio)
      ? XP_RULES.cardioProgression
      : 0;
    const dayCompleteXp = dayGreen(log) ? XP_RULES.dayCompleteBonus : 0;
    const totalXp = strengthXp + cardioXp + durationXp + sessionXp + recoveryXp + taskXp
      + strengthProgressXp + cardioProgressXp + dayCompleteXp + (streakXp[date] || 0);

    rows.push({ date, totalXp });
  }

  return rows;
}

export function sumGroupChallengeTrainingXp(rows = [], startDate = "", endDate = "") {
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
    const date = String(row?.date || "");
    if (startDate && date < startDate) return sum;
    if (endDate && date > endDate) return sum;
    return sum + Math.max(0, safeNumber(row?.totalXp));
  }, 0);
}
