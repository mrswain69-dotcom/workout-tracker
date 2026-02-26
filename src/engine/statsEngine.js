// src/engine/statsEngine.js
import { SPORTS } from "../config/badges";

function safeNumber(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function normaliseYmd(dateLike) {
  if (!dateLike) return null;

  // Already in YYYY-MM-DD
  if (typeof dateLike === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateLike)) {
    return dateLike;
  }

  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function mapCardioTypeToSport(cardioType) {
  const t = (cardioType || "").toLowerCase();

  if (t.includes("run")) return SPORTS.RUN;
  if (t.includes("bike") || t.includes("cycle")) return SPORTS.BIKE;
  if (t.includes("walk")) return SPORTS.WALK;
  if (t.includes("swim")) return SPORTS.SWIM;
  if (t.includes("row")) return SPORTS.ROW;

  return null;
}

/**
 * Build stats used by the BadgeEngine from the allLogs array.
 *
 * records: array of rows from listLogs:
 *   [{ date_ymd, date?, log }]
 */
export function buildStatsFromRecords(records, today = new Date()) {
  const stats = {
    // Best single-session distance per sport
    bestDistanceBySport: {}, // e.g. { run: 21.1, bike: 200 }

    // Best single-session avg speed per sport
    bestAvgSpeedBySport: {}, // e.g. { run: 15.2, bike: 29.5 }

    // Repetition counts: "how many sessions ≥ this distance" per sport
    // { run: { "5": 12, "10": 4 }, bike: { "20": 3, "50": 1 }, ... }
    distanceSessionCountsBySportAndBucket: {},

    // Streak in days (any activity)
    streakDays: 0,
  };

  if (!Array.isArray(records) || records.length === 0) {
    return stats;
  }

  // ─────────────────────────────────────────────
  // 1. Initialise distance repetition buckets
  //    (this defines what distances we care about counting)
  // ─────────────────────────────────────────────
  const distanceBucketsBySport = {
    [SPORTS.RUN]: [5, 10], // 5k, 10k (you can extend with 15, 21.1 later)
    [SPORTS.BIKE]: [5, 10, 20, 30, 50, 75, 100, 150, 200],
    // Add SWIM/ROW/WALK buckets here later if you want repetition tiers
  };

  Object.keys(distanceBucketsBySport).forEach((sport) => {
    stats.distanceSessionCountsBySportAndBucket[sport] = {};
    distanceBucketsBySport[sport].forEach((bucket) => {
      stats.distanceSessionCountsBySportAndBucket[sport][String(bucket)] = 0;
    });
  });

  // ─────────────────────────────────────────────
  // 2. Walk through all logs, compute stats
  // ─────────────────────────────────────────────
  const activeDates = new Set();

  for (const row of records) {
    if (!row) continue;

    const ymd =
      normaliseYmd(row.date_ymd) ||
      normaliseYmd(row.date) ||
      normaliseYmd(row.log?.date_ymd);

    if (ymd) {
      activeDates.add(ymd);
    }

    const log = row.log;
    const blocks = Array.isArray(log?.blocks) ? log.blocks : [];

    for (const block of blocks) {
      if (!block || block.typeId !== "cardio") continue;

      const sport = mapCardioTypeToSport(block.cardioType || "run");
      if (!sport) continue;

      const cardio = block.cardio || {};
      const distanceKm = safeNumber(
        cardio.distanceKm ?? block.distanceKm ?? 0
      );
      const durationMin = safeNumber(
        cardio.durationMin ?? block.durationMin ?? 0
      );

      // Best distance per sport
      if (distanceKm > 0) {
        const prevBestDist = stats.bestDistanceBySport[sport] || 0;
        if (distanceKm > prevBestDist) {
          stats.bestDistanceBySport[sport] = distanceKm;
        }
      }

      // Best speed per sport (either derived or taken from avgSpeedKmh)
      let avgSpeed = 0;
      if (distanceKm > 0 && durationMin > 0) {
        const hours = durationMin / 60;
        avgSpeed = hours > 0 ? distanceKm / hours : 0;
      } else if (cardio.avgSpeedKmh != null && cardio.avgSpeedKmh !== "") {
        avgSpeed = safeNumber(cardio.avgSpeedKmh);
      }

      if (avgSpeed > 0) {
        const prevBestSpeed = stats.bestAvgSpeedBySport[sport] || 0;
        if (avgSpeed > prevBestSpeed) {
          stats.bestAvgSpeedBySport[sport] = avgSpeed;
        }
      }

      // Distance repetition counts
      const buckets = distanceBucketsBySport[sport] || [];
      for (const bucket of buckets) {
        if (distanceKm >= bucket) {
          const key = String(bucket);
          stats.distanceSessionCountsBySportAndBucket[sport][key] =
            (stats.distanceSessionCountsBySportAndBucket[sport][key] || 0) + 1;
        }
      }
    }
  }

  // ─────────────────────────────────────────────
  // 3. Compute streak
  // ─────────────────────────────────────────────
  stats.streakDays = computeStreakDays(activeDates, today);

  return stats;
}

function computeStreakDays(activeDates, today) {
  if (!activeDates || activeDates.size === 0) return 0;

  let streak = 0;
  const cursor = new Date(today);

  // Walk backwards from today while we have logs on consecutive days
  while (true) {
    const key = normaliseYmd(cursor);
    if (!key || !activeDates.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
