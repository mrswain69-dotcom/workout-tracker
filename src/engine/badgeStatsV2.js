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
    } else if (typeId === "cardio") {
      const c = block.cardio || {};
      hasData = safeNum(c.distanceKm) > 0 || safeNum(c.durationMin) > 0;
    } else if (typeId === "duration") {
      hasData = safeNum(block?.duration?.minutes) > 0;
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

function extractCardioEfforts(log) {
  const out = [];
  const blocks = Array.isArray(log?.blocks) ? log.blocks : [];

  for (const b of blocks) {
    if (b?.typeId !== "cardio") continue;
    const c = b.cardio || {};
    const sport = String(
  c.sport ||
    b.cardioType ||
    b.sport ||
    ""
).toLowerCase();
    const km = safeNum(c.distanceKm);
    const min = safeNum(c.durationMin);
    if (sport && km > 0 && min > 0) out.push({ sport, km, min });
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
  // Streak (green days)
  // -----------------------------
  const greenByDate = new Map(); // date -> boolean

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

    // Behaviour time-based (needs startTs)
    const startTs = log?.meta?.startTs;
    if (startTs != null) {
      const d = typeof startTs === "number" ? new Date(startTs) : new Date(startTs);
      if (!Number.isNaN(d.getTime())) {
        const hour = d.getHours();
        if (hour < earlyCutoffHour) earlyBirdSessions += 1;
        if (hour >= nightCutoffHour) nightSessions += 1;
      }
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
    cardio,
    intelligence: {
      progressiveOverloadEvents: 0, // placeholder until BI engine emits events
      paceImprovementPct4w,
      paceImprovementSport,
    },
  };

}
