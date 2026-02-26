// src/engine/statsEngine.js
import { SPORTS } from "../config/badges";

function safeNumber(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function normaliseYmd(dateLike) {
  if (!dateLike) return null;
  if (typeof dateLike === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateLike)) {
    return dateLike;
  }
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function mapCardioTypeToSport(cardioType) {
  const t = (cardioType || "").toLowerCase();
  if (t === "run" || t.includes("run")) return SPORTS.RUN;
  if (t === "cycle" || t === "bike" || t.includes("bike")) return SPORTS.BIKE;
  if (t === "walk" || t.includes("walk")) return SPORTS.WALK;
  if (t === "swim" || t.includes("swim")) return SPORTS.SWIM;
  if (t === "row" || t.includes("row")) return SPORTS.ROW;
  return null;
}

/**
 * Build stats used by the BadgeEngine from the allLogs array.
 * - records: [{ date_ymd, date?, log }]
 * - today: Date (defaults to now)
 */
export function buildStatsFromRecords(records, today = new Date()) {
  const stats = {
    bestDistanceBySport: {}, // e.g. { run: 21.1, bike: 200 }
    bestAvgSpeedBySport: {}, // e.g. { run: 15.5, bike: 30.2 }
    streakDays: 0,
  };

  if (!Array.isArray(records) || !records.length) {
    return stats;
  }

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

      // Distance-based stats
      if (distanceKm > 0) {
        const prevBestDist = stats.bestDistanceBySport[sport] || 0;
        if (distanceKm > prevBestDist) {
          stats.bestDistanceBySport[sport] = distanceKm;
        }
      }

      // Speed-based stats
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
    }
  }

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