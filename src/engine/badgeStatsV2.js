// src/engine/badgeStatsV2.js
//
// Builds stats used by badges.js.
// Inputs:
// - allLogs = [{date_ymd, log}] (or {date, log})
// - todayYmd (optional)
// - isAdult (optional) -> early/night cutoffs
//
// Notes:
// - "Green day" logic is self-contained here (streak computation).
// - Early/Night requires log.meta.startTs (ISO string or epoch ms). If missing -> 0.

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function ymd(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymdAddDays(ymdStr, deltaDays) {
  const d = new Date(`${ymdStr}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return ymd(d);
}

function estimateTimeSecForDistance(effort, targetKm) {
  const km = safeNum(effort.km);
  const min = safeNum(effort.min);
  if (km <= 0 || min <= 0 || targetKm <= 0) return null;
  const paceSecPerKm = (min * 60) / km;
  return paceSecPerKm * targetKm;
}

function bestTime(existing, candidate) {
  if (candidate == null) return existing;
  if (existing == null) return candidate;
  return Math.min(existing, candidate);
}

function isTrainingBlock(block) {
  if (!block || block.cancelled) return false;
  const typeId = String(block.typeId || "").toLowerCase();

  if (typeId === "strength" || typeId === "hiit" || typeId === "box") {
    const setsObj = block.sets && typeof block.sets === "object" ? block.sets : null;
    return !!(
      setsObj &&
      Object.values(setsObj).some(
        (arr) => Array.isArray(arr) && arr.some(setDidSomething)
      )
    );
  }

  if (
    typeId === "cardio" ||
    typeId === "run" ||
    typeId === "swim" ||
    typeId === "walk" ||
    typeId === "row" ||
    typeId === "cycle" ||
    typeId === "bike"
  ) {
    const c = block.cardio || {};
    return safeNum(c.distanceKm) > 0 || safeNum(c.durationMin) > 0;
  }

  if (typeId === "duration") {
    return safeNum(block?.duration?.minutes) > 0;
  }

  return false;
}

function hasRecoveryDone(log) {
  const blocks = Array.isArray(log?.blocks) ? log.blocks : [];
  return blocks.some(
    (b) => b && !b.cancelled && b.typeId === "recovery" && b.recoveryDone
  );
}

function buildRecoveryDayMap(rows) {
  const map = new Map();

  for (const row of rows) {
    const dateStr = row?.date_ymd || row?.date;
    const log = row?.log;
    if (!dateStr || !log) continue;

    const blocks = Array.isArray(log.blocks) ? log.blocks : [];
    const trained = blocks.some(isTrainingBlock);
    const recoveryDone = hasRecoveryDone(log);

    map.set(dateStr, {
      date: dateStr,
      trained,
      recoveryDone,
    });
  }

  return map;
}

function countTrainingDaysInWindow(dayMap, endYmd, daysBack) {
  let count = 0;
  for (let i = 1; i <= daysBack; i++) {
    const d = ymdAddDays(endYmd, -i);
    if (dayMap.get(d)?.trained) count += 1;
  }
  return count;
}

function countQualifyingRecoveryDaysInWindow(dayMap, endYmd, daysBack) {
  let count = 0;
  for (let i = 1; i <= daysBack; i++) {
    const d = ymdAddDays(endYmd, -i);
    if (dayMap.get(d)?.recoveryQualified) count += 1;
  }
  return count;
}

function countConsecutiveTrainingDaysBefore(dayMap, endYmd) {
  let run = 0;
  for (let i = 1; i <= 30; i++) {
    const d = ymdAddDays(endYmd, -i);
    if (dayMap.get(d)?.trained) run += 1;
    else break;
  }
  return run;
}

function getRecoveryEligibilityForDate(dayMap, dateStr) {
  const day = dayMap.get(dateStr);
  if (!day || !day.recoveryDone) {
    return {
      qualifies: false,
      score: 0,
      reasons: [],
    };
  }

  const reasons = [];
  let score = 0;

  const trainingLast5 = countTrainingDaysInWindow(dayMap, dateStr, 5);
  const trainingLast7 = countTrainingDaysInWindow(dayMap, dateStr, 7);
  const qualifyingRecoveryLast7 = countQualifyingRecoveryDaysInWindow(dayMap, dateStr, 7);
  const prevDay = dayMap.get(ymdAddDays(dateStr, -1));

  // +1 user trained ≥2 of last 5 days
  if (trainingLast5 >= 2) {
    score += 1;
    reasons.push("trained_2_of_last_5");
  }

  // +1 user trained ≥4 of last 7 days
  if (trainingLast7 >= 4) {
    score += 1;
    reasons.push("trained_4_of_last_7");
  }

  // -1 previous day was recovery
  if (prevDay?.recoveryQualified || prevDay?.recoveryDone) {
    score -= 1;
    reasons.push("previous_day_recovery");
  }

  // -1 fewer than 2 training days in last 7 days
  if (trainingLast7 < 2) {
    score -= 1;
    reasons.push("too_little_recent_training");
  }

  // -1 already used 2 qualifying recovery days in last 7 days
  if (qualifyingRecoveryLast7 >= 2) {
    score -= 1;
    reasons.push("too_many_recent_recovery_days");
  }

  const hardBlocked =
    qualifyingRecoveryLast7 >= 2 ||
    !!(prevDay?.recoveryQualified || prevDay?.recoveryDone) ||
    trainingLast7 < 2;

  return {
    qualifies: !hardBlocked && score >= 1,
    score,
    reasons,
    trainingLast5,
    trainingLast7,
    qualifyingRecoveryLast7,
    consecutiveTrainingDaysBefore: countConsecutiveTrainingDaysBefore(dayMap, dateStr),
  };
}

function getRecoveryRecommendationForToday(dayMap, todayYmd) {
  const trainingLast5 = countTrainingDaysInWindow(dayMap, todayYmd, 5);
  const trainingLast7 = countTrainingDaysInWindow(dayMap, todayYmd, 7);
  const consecutiveTrainingBefore = countConsecutiveTrainingDaysBefore(dayMap, todayYmd);

  const shouldRecommend =
    consecutiveTrainingBefore >= 3 ||
    trainingLast5 >= 4 ||
    trainingLast7 >= 5;

  return {
    recommended: shouldRecommend,
    reasons: {
      consecutiveTrainingBefore,
      trainingLast5,
      trainingLast7,
    },
  };
}

// A set is "done" if any meaningful field exists.
function setDidSomething(s) {
  if (!s) return false;
  const reps = safeNum(s.reps);
  const time = safeNum(s.timeSeconds);
  const count = safeNum(s.count);
  const distanceKm = safeNum(s.distanceKm);
  const durationMin = safeNum(s.durationMin);
  return reps > 0 || time > 0 || count > 0 || distanceKm > 0 || durationMin > 0;
}

function getSessionHourWindow(log, row) {
  const blocks = Array.isArray(log?.blocks) ? log.blocks : [];

  let earliestMs = null;
  let latestMs = null;

  const considerRaw = (raw) => {
    if (!raw) return;
    const d = typeof raw === "number" ? new Date(raw) : new Date(raw);
    const ms = d.getTime();
    if (Number.isNaN(ms)) return;

    if (earliestMs == null || ms < earliestMs) earliestMs = ms;
    if (latestMs == null || ms > latestMs) latestMs = ms;
  };

  for (const b of blocks) {
    if (!b || b.cancelled) continue;

    let hasData = false;
    const typeId = String(b.typeId || "").toLowerCase();

    if (typeId === "strength" || typeId === "hiit" || typeId === "box") {
      const setsObj = b.sets && typeof b.sets === "object" ? b.sets : null;
      hasData = !!(
        setsObj &&
        Object.values(setsObj).some(
          (arr) => Array.isArray(arr) && arr.some(setDidSomething)
        )
      );
    } else if (
      typeId === "cardio" ||
      typeId === "run" ||
      typeId === "swim" ||
      typeId === "walk" ||
      typeId === "row" ||
      typeId === "cycle" ||
      typeId === "bike"
    ) {
      const c = b.cardio || {};
      hasData = safeNum(c.distanceKm) > 0 || safeNum(c.durationMin) > 0;
    } else if (typeId === "duration") {
      hasData = safeNum(b?.duration?.minutes) > 0;
    } else if (typeId === "recovery") {
      hasData = !!b?.recoveryDone;
    }

    if (!hasData) continue;

    considerRaw(b?.startedAt);
    considerRaw(b?.completedAt);
    considerRaw(b?.loggedAt);
    considerRaw(b?.createdAt);
    considerRaw(b?.updatedAt);
  }

  // Fallback 1: log-level meta
  if (earliestMs == null && latestMs == null) {
    considerRaw(log?.meta?.startTs);
    considerRaw(log?.meta?.endTs);
    considerRaw(log?.meta?.completedTs);
  }

  // Fallback 2: DB row timestamps passed through from App.jsx
  if (earliestMs == null && latestMs == null) {
    considerRaw(row?.created_at);
    considerRaw(row?.updated_at);
  }

  if (earliestMs == null && latestMs == null) {
    return {
      earliestHour: null,
      latestHour: null,
    };
  }

  return {
    earliestHour: new Date(earliestMs).getHours(),
    latestHour: new Date(latestMs).getHours(),
  };
}

// Green day = all non-cancelled, non-task blocks are "complete" (have data)
function isDayGreen(log) {
  if (!log || !Array.isArray(log.blocks) || !log.blocks.length) return false;

  let anyCountedBlock = false;

  for (const block of log.blocks) {
    if (!block) continue;
    if (block.cancelled) continue;

    const typeId = block.typeId;

    // tasks do not count towards green day requirement
    if (typeId === "tasks") continue;

    let hasData = false;

        if (typeId === "strength" || typeId === "hiit" || typeId === "box") {
      const setsObj = block.sets && typeof block.sets === "object" ? block.sets : null;
      if (setsObj) {
        hasData = Object.values(setsObj).some(
          (arr) => Array.isArray(arr) && arr.some(setDidSomething)
        );
      }
        } else if (
      typeId === "cardio" ||
      typeId === "run" ||
      typeId === "swim" ||
      typeId === "walk" ||
      typeId === "row" ||
      typeId === "cycle" ||
      typeId === "bike"
    ) {
      const c = block.cardio || {};
      hasData = safeNum(c.distanceKm) > 0 || safeNum(c.durationMin) > 0;
    } else if (typeId === "duration") {
      hasData = safeNum(block?.duration?.minutes) > 0;
    } else if (typeId === "recovery") {
      hasData = !!block?.recoveryDone;
    }

    if (!hasData) return false;
    anyCountedBlock = true;
  }

  return anyCountedBlock;
}

// -----------------------------------------------------
// SPORT DISTANCE MAP (must match badges.js keys)
// -----------------------------------------------------
const SPORT_DISTANCES = {
  run: [
    { key: "5k", km: 5 },
    { key: "10k", km: 10 },
    { key: "15k", km: 15 },
    { key: "half", km: 21.1 },
    { key: "30k", km: 30 },
    { key: "marathon", km: 42.195 },
    { key: "ultra50", km: 50 },
  ],
  bike: [
    { key: "10k", km: 10 },
    { key: "20k", km: 20 },
    { key: "40k", km: 40 },
    { key: "60k", km: 60 },
    { key: "100k", km: 100 },
    { key: "160k", km: 160 },
    { key: "250k", km: 250 },
  ],
  walk: [
    { key: "3k", km: 3 },
    { key: "5k", km: 5 },
    { key: "10k", km: 10 },
    { key: "15k", km: 15 },
    { key: "half", km: 21.1 },
    { key: "marathon", km: 42.195 },
    { key: "50k", km: 50 },
  ],
  row: [
    { key: "500m", km: 0.5 },
    { key: "1k", km: 1 },
    { key: "2k", km: 2 },
    { key: "5k", km: 5 },
    { key: "10k", km: 10 },
    { key: "half", km: 21.097 },
    { key: "marathon", km: 42.195 },
  ],
  swim: [
    { key: "200m", km: 0.2 },
    { key: "400m", km: 0.4 },
    { key: "750m", km: 0.75 },
    { key: "1500m", km: 1.5 },
    { key: "3k", km: 3 },
    { key: "5k", km: 5 },
    { key: "10k", km: 10 },
  ],
};

const PACE_DISTANCES = {
  run: ["5k", "10k", "half"],
  bike: ["20k", "40k", "100k"],
  walk: ["5k", "10k", "half"],
  row: ["2k", "5k", "10k"],
  swim: ["750m", "1500m", "3k"],
};

// -----------------------------------------------------
// SPORT MASTERY MAP
// Phase B only:
// - recognise sport names from activityName / label / note
// - count max 1 sport session per sport per day
// - do NOT yet wire into badge defs / avatar unlocks
// -----------------------------------------------------
const SPORT_MASTERY_KEYS = [
  "football",
  "rugby",
  "basketball",
  "badminton",
  "tennis",
  "martial_arts",
  "fencing",
  "yoga",
  "netball",
  "hockey",
  "indoor_rowing",
];

const SPORT_NAME_MATCHERS = [
  { key: "football", terms: ["football", "soccer"] },
  { key: "rugby", terms: ["rugby"] },
  { key: "basketball", terms: ["basketball"] },
  { key: "badminton", terms: ["badminton"] },
  { key: "tennis", terms: ["tennis"] },
  {
    key: "martial_arts",
    terms: [
      "martial arts",
      "martial",
      "karate",
      "judo",
      "taekwondo",
      "tae kwon do",
      "jiu jitsu",
      "jujitsu",
      "ju jitsu",
      "kickboxing",
      "muay thai",
      "boxing",
    ],
  },
  { key: "fencing", terms: ["fencing"] },
  { key: "yoga", terms: ["yoga", "tai chi", "pilates"] },
  { key: "netball", terms: ["netball"] },
  { key: "hockey", terms: ["hockey"] },
  {
    key: "indoor_rowing",
    terms: [
      "indoor rowing",
      "indoor row",
      "erg",
      "erg row",
      "erg rowing",
      "rowing machine",
      "concept2",
      "concept 2",
      "indoor erg",
    ],
  },
];

function normaliseText(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSportKeyFromText(text) {
  const t = normaliseText(text);
  if (!t) return null;

  for (const matcher of SPORT_NAME_MATCHERS) {
    for (const term of matcher.terms) {
      if (t.includes(term)) return matcher.key;
    }
  }

  return null;
}

function createEmptySportMasteryBucket() {
  const out = {};
  for (const key of SPORT_MASTERY_KEYS) {
    out[key] = {
      sessions: 0,
      days: 0,
      lastDate: null,
    };
  }
  return out;
}

function getSportKeysForLog(log) {
  const keys = new Set();
  const blocks = Array.isArray(log?.blocks) ? log.blocks : [];

  for (const b of blocks) {
    if (!b || b.cancelled) continue;

    const typeId = normaliseText(b.typeId);

    // We only care about cardio + duration style blocks for sport mastery.
    if (
      typeId !== "cardio" &&
      typeId !== "run" &&
      typeId !== "swim" &&
      typeId !== "walk" &&
      typeId !== "row" &&
      typeId !== "cycle" &&
      typeId !== "bike" &&
      typeId !== "duration"
    ) {
      continue;
    }

    // Must have actual logged data
    let hasData = false;

    if (
      typeId === "cardio" ||
      typeId === "run" ||
      typeId === "swim" ||
      typeId === "walk" ||
      typeId === "row" ||
      typeId === "cycle" ||
      typeId === "bike"
    ) {
      const c = b.cardio || {};
      hasData = safeNum(c.distanceKm) > 0 || safeNum(c.durationMin) > 0;
    } else if (typeId === "duration") {
      hasData = safeNum(b?.duration?.minutes) > 0;
    }

    if (!hasData) continue;

    // Priority:
    // 1) explicit activityName
    // 2) cardioType other/team_sport/no_distance won't give sport identity reliably,
    //    so also inspect label/note
    // 3) if still nothing, ignore
    const candidates = [
      b?.activityName,
      b?.label,
      b?.note,
      b?.cardioTypeOtherLabel,
    ];

    let found = null;
    for (const text of candidates) {
      found = getSportKeyFromText(text);
      if (found) break;
    }

    if (found) {
      keys.add(found);
    }
  }

  return Array.from(keys);
}

function scoreStrengthSets(sets) {
  const arr = Array.isArray(sets) ? sets : [];
  let total = 0;

  for (const s of arr) {
    if (!setDidSomething(s)) continue;

    const reps = safeNum(s.reps);
    const weight = safeNum(s.weight);
    const time = safeNum(s.timeSeconds);
    const count = safeNum(s.count);

    // Weight x reps is the strongest signal.
    // Reps/time/count still contribute if weight is absent.
    total += reps * weight;
    total += reps * 0.5;
    total += time * 0.1;
    total += count * 0.5;
  }

  return total;
}

function getLoggedStrengthSetsByMovement(log) {
  const out = {};
  const blocks = Array.isArray(log?.blocks) ? log.blocks : [];

  for (const b of blocks) {
    if (!b || b.cancelled) continue;
    if (b.typeId !== "strength" && b.typeId !== "hiit" && b.typeId !== "box") continue;

    const setsObj = b.sets && typeof b.sets === "object" ? b.sets : {};
    for (const [movementId, arr] of Object.entries(setsObj)) {
      const sets = Array.isArray(arr) ? arr : [];
      if (!sets.some(setDidSomething)) continue;

      if (!out[movementId]) out[movementId] = [];
      out[movementId].push(...sets);
    }
  }

  return out;
}

function extractCardioEfforts(log) {
  const out = [];
  const blocks = Array.isArray(log?.blocks) ? log.blocks : [];

  for (const b of blocks) {
    const typeId = String(b?.typeId || "").toLowerCase();

    if (
      typeId !== "cardio" &&
      typeId !== "run" &&
      typeId !== "swim" &&
      typeId !== "walk" &&
      typeId !== "row" &&
      typeId !== "cycle" &&
      typeId !== "bike"
    ) {
      continue;
    }

    const c = b.cardio || {};
    const cardioType = String(b?.cardioType || "").toLowerCase();

    // IMPORTANT:
    // team_sport / no_distance are real sport sessions for sport mastery,
    // but they must NOT feed measurable run/bike/swim/row pace-distance badges.
    if (cardioType === "team_sport" || cardioType === "no_distance") {
      continue;
    }

    let sport = String(
      c.sport ||
      b.cardioType ||
      b.sport ||
      typeId ||
      ""
    ).toLowerCase();

    // Indoor rowing should feed measurable rowing performance badges too.
    if (sport === "indoor_rowing") sport = "row";

    if (sport === "cardio") {
      const label = String(b?.label || "").toLowerCase();
      const note = String(b?.note || "").toLowerCase();

      if (label.includes("run") || note.includes("run")) sport = "run";
      else if (label.includes("walk") || note.includes("walk")) sport = "walk";
      else if (label.includes("swim") || note.includes("swim")) sport = "swim";
      else if (
        label.includes("indoor rowing") ||
        note.includes("indoor rowing") ||
        label.includes("indoor row") ||
        note.includes("indoor row") ||
        label.includes("rowing machine") ||
        note.includes("rowing machine") ||
        label.includes("concept2") ||
        note.includes("concept2") ||
        label.includes("concept 2") ||
        note.includes("concept 2") ||
        label.includes("erg") ||
        note.includes("erg") ||
        label.includes("row") ||
        note.includes("row")
      ) {
        sport = "row";
      } else if (
        label.includes("bike") ||
        label.includes("cycle") ||
        note.includes("bike") ||
        note.includes("cycle")
      ) {
        sport = "bike";
      }
    }

    if (sport === "cycle") sport = "bike";

    const km = safeNum(c.distanceKm);
    const min = safeNum(c.durationMin);

    if (sport && km > 0 && min > 0) {
      out.push({ sport, km, min });
    }
  }

  return out;
}

export function buildBadgeStatsV2({ allLogs, todayYmd, isAdult }) {
  const rows = Array.isArray(allLogs) ? allLogs : [];
  const today = todayYmd || ymd(new Date());

  // -----------------------------
  // Strength stats
  // -----------------------------
  let totalVolumeKg = 0;
  let totalSets = 0;
  let totalReps = 0;
  let maxStrengthSetsInSession = 0;

// -----------------------------
// Behaviour
// -----------------------------
const earlyCutoffHour = isAdult ? 7 : 8;
const nightCutoffHour = isAdult ? 20 : 19;
let earlyBirdSessions = 0;
let nightSessions = 0;

// -----------------------------
// Progressive overload
// -----------------------------
let progressiveOverloadEvents = 0;
const lastStrengthScoreByMovement = new Map();

  // -----------------------------
  // Streak (green days)
  // -----------------------------
  const greenByDate = new Map(); // date -> boolean

  // -----------------------------
  // Recovery
  // -----------------------------
  let totalRecoveryDays = 0;
  let qualifyingRecoveryDays = 0;

    // -----------------------------
  // Sport mastery (Phase B)
  // -----------------------------
  const sportMastery = createEmptySportMasteryBucket();

  // -----------------------------
  // Cardio stats
  // -----------------------------
  const cardio = {};
  for (const sport of Object.keys(SPORT_DISTANCES)) {
    cardio[sport] = {
      count: {},
      bestTimeSec: {},
      bestTimeLast28: {},
      bestTimePrev28: {},
    };

    for (const d of SPORT_DISTANCES[sport]) cardio[sport].count[d.key] = 0;
    for (const k of PACE_DISTANCES[sport]) {
      cardio[sport].bestTimeSec[k] = null;
      cardio[sport].bestTimeLast28[k] = null;
      cardio[sport].bestTimePrev28[k] = null;
    }
  }

  // -----------------------------
  // Iterate logs
  // -----------------------------
  for (const row of rows) {
    const log = row?.log;
    const dateStr = row?.date_ymd || row?.date;
    if (!log || !dateStr) continue;

    // Green-day marking for streak
    greenByDate.set(dateStr, isDayGreen(log));

    // Strength processing (strength only counts sets/reps/volume)
    let sessionSets = 0;
    const blocks = Array.isArray(log.blocks) ? log.blocks : [];

    const recoveryDoneToday = hasRecoveryDone(log);

    // Progressive overload:
    // count 1 event whenever the current logged score for a movement
    // beats the last previously logged score for that same movement.
    const strengthSetsByMovement = getLoggedStrengthSetsByMovement(log);
    for (const [movementId, sets] of Object.entries(strengthSetsByMovement)) {
      const currentScore = scoreStrengthSets(sets);
      if (currentScore <= 0) continue;

      const lastScore = lastStrengthScoreByMovement.get(movementId);
      if (lastScore != null && currentScore > lastScore) {
        progressiveOverloadEvents += 1;
      }

      if (lastScore == null || currentScore > lastScore) {
        lastStrengthScoreByMovement.set(movementId, currentScore);
      }
    }

    if (recoveryDoneToday) {
      totalRecoveryDays += 1;
    }

    // Sport mastery:
    // Count max 1 session per sport per day.
    const sportKeysForDay = getSportKeysForLog(log);
    for (const sportKey of sportKeysForDay) {
      if (!sportMastery[sportKey]) continue;

      sportMastery[sportKey].sessions += 1;
      sportMastery[sportKey].days += 1;
      sportMastery[sportKey].lastDate = dateStr;
    }

    for (const b of blocks) {
      if (!b || b.cancelled) continue;
      if (b.typeId !== "strength") continue;

      const setsObj = b.sets && typeof b.sets === "object" ? b.sets : {};
      for (const arr of Object.values(setsObj)) {
        const sets = Array.isArray(arr) ? arr : [];
        for (const s of sets) {
          if (!setDidSomething(s)) continue;

          const reps = safeNum(s.reps);
          const weight = safeNum(s.weight);

          totalSets += 1;
          sessionSets += 1;

          if (reps > 0) totalReps += reps;
          if (reps > 0 && weight > 0) totalVolumeKg += reps * weight;
        }
      }
    }

    maxStrengthSetsInSession = Math.max(maxStrengthSetsInSession, sessionSets);

// Behaviour time-based
const sessionWindow = getSessionHourWindow(log, row);
const earliestHour = sessionWindow?.earliestHour;
const latestHour = sessionWindow?.latestHour;

if (earliestHour != null && earliestHour < earlyCutoffHour) {
  earlyBirdSessions += 1;
}

if (latestHour != null && latestHour >= nightCutoffHour) {
  nightSessions += 1;
}

    // Cardio processing
    const efforts = extractCardioEfforts(log);
    if (!efforts.length) continue;

    const dayDiff =
      (new Date(`${today}T00:00:00`) - new Date(`${dateStr}T00:00:00`)) / 86400000;

    for (const e of efforts) {
      const sport = e.sport;
      if (!SPORT_DISTANCES[sport]) continue;

      // Count distance+ occurrences
      for (const d of SPORT_DISTANCES[sport]) {
        if (e.km >= d.km) cardio[sport].count[d.key] += 1;
      }

      // Best time estimates for pace badge distances only
      for (const key of PACE_DISTANCES[sport]) {
        const dist = SPORT_DISTANCES[sport].find((d) => d.key === key);
        if (!dist) continue;
        if (e.km >= dist.km) {
          const est = estimateTimeSecForDistance(e, dist.km);
          cardio[sport].bestTimeSec[key] = bestTime(cardio[sport].bestTimeSec[key], est);

          if (dayDiff >= 0 && dayDiff < 28) {
            cardio[sport].bestTimeLast28[key] = bestTime(cardio[sport].bestTimeLast28[key], est);
          } else if (dayDiff >= 28 && dayDiff < 56) {
            cardio[sport].bestTimePrev28[key] = bestTime(cardio[sport].bestTimePrev28[key], est);
          }
        }
      }
    }
  }

  // -----------------------------
  // Current streak (ending today)
  // -----------------------------
  let currentStreakDays = 0;
  for (let i = 0; i < 2000; i++) {
    const d = ymdAddDays(today, -i);
    if (greenByDate.get(d) === true) {
      currentStreakDays += 1;
    } else {
      break;
    }
  }

  // Longest streak (scan)
  // Missing days break the streak.
  const allDates = Array.from(greenByDate.keys()).sort((a, b) => (a < b ? -1 : 1));
  let longestStreakDays = 0;
  let runLen = 0;

  for (let i = 0; i < allDates.length; i++) {
    const d = allDates[i];
    const isGreen = greenByDate.get(d) === true;

    if (!isGreen) {
      runLen = 0;
      continue;
    }

    if (i === 0) {
      runLen = 1;
    } else {
      const prev = allDates[i - 1];
      const expected = ymdAddDays(prev, 1);
      runLen = d === expected ? runLen + 1 : 1;
    }

    if (runLen > longestStreakDays) longestStreakDays = runLen;
  }

    // -----------------------------
  // Recovery qualification + recommendation
  // -----------------------------
  const recoveryDayMap = buildRecoveryDayMap(rows);
  const orderedRecoveryDates = Array.from(recoveryDayMap.keys()).sort((a, b) =>
    a < b ? -1 : 1
  );

  for (const d of orderedRecoveryDates) {
    const info = recoveryDayMap.get(d);
    if (!info?.recoveryDone) continue;

    const eligibility = getRecoveryEligibilityForDate(recoveryDayMap, d);
    info.recoveryQualified = eligibility.qualifies;
    info.recoveryScore = eligibility.score;
    info.recoveryReasons = eligibility.reasons;

    if (eligibility.qualifies) {
      qualifyingRecoveryDays += 1;
    }
  }

  const recoveryRecommendation = getRecoveryRecommendationForToday(
    recoveryDayMap,
    today
  );
  
  // -----------------------------
  // Pace improvement (best improvement across sports/pace distances)
  // improvement = (prev - cur) / prev * 100
  // -----------------------------
  let paceImprovementPct4w = 0;
  let paceImprovementSport = null;

  function improvement(prev, cur) {
    if (prev == null || cur == null || prev <= 0 || cur <= 0) return null;
    return ((prev - cur) / prev) * 100;
  }

  for (const sport of Object.keys(PACE_DISTANCES)) {
    for (const key of PACE_DISTANCES[sport]) {
      const prev = cardio[sport].bestTimePrev28[key];
      const cur = cardio[sport].bestTimeLast28[key];
      const imp = improvement(prev, cur);
      if (imp != null && imp > paceImprovementPct4w) {
        paceImprovementPct4w = imp;
        paceImprovementSport = sport;
      }
    }
  }

  paceImprovementPct4w = Math.round(paceImprovementPct4w * 10) / 10;

  return {
    lifts: {
      totalVolumeKg: Math.round(totalVolumeKg),
      totalSets,
      totalReps,
    },
    sessions: {
      maxStrengthSetsInSession,
    },
    behaviour: {
      earlyBirdSessions,
      nightSessions,
      earlyCutoffHour,
      nightCutoffHour,
    },
    streak: {
      currentDays: currentStreakDays,
      longestDays: longestStreakDays,
    },
    recovery: {
      totalRecoveryDays,
      qualifyingRecoveryDays,
      recommendation: recoveryRecommendation,
      readiness: {
        muscleRecoveryPct: Math.max(
          35,
          Math.min(
            100,
            100 - recoveryRecommendation.reasons.trainingLast5 * 8
          )
        ),
        nervousSystemPct: Math.max(
          30,
          Math.min(
            100,
            100 - recoveryRecommendation.reasons.consecutiveTrainingBefore * 12
          )
        ),
        energyPct: Math.max(
          40,
          Math.min(
            100,
            100 - recoveryRecommendation.reasons.trainingLast7 * 7
          )
        ),
      },
    },
    cardio,
    sportMastery,
    intelligence: {
  progressiveOverloadEvents,
  paceImprovementPct4w,
  paceImprovementSport,
},
  };

}




