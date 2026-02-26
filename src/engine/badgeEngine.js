// src/engine/badgeEngine.js
import {
  badgeDefinitions,
  BADGE_TRIGGER_TYPES,
} from "../config/badges";

/**
 * Evaluate which badges are earned and how far along we are for each.
 *
 * @param {object} stats - result of buildStatsFromRecords
 * @param {string[]} ownedBadgeIds - badges already recorded / stored (optional)
 */
export function evaluateBadges(stats, ownedBadgeIds = []) {
  const newlyEarned = [];
  const allEarned = new Set(ownedBadgeIds || []);
  const progressById = {};

  for (const badge of badgeDefinitions) {
    const { earned, progress } = evaluateSingleBadge(badge, stats);
    progressById[badge.id] = progress;

    if (earned && !allEarned.has(badge.id)) {
      newlyEarned.push(badge.id);
      allEarned.add(badge.id);
    }
  }

  return {
    earnedBadgeIds: Array.from(allEarned),
    newlyEarned,
    progressById,
  };
}

function evaluateSingleBadge(badge, stats) {
  switch (badge.triggerType) {
    case BADGE_TRIGGER_TYPES.SESSION_BEST_THRESHOLD:
      return evalSessionBestThreshold(badge, stats);
    case BADGE_TRIGGER_TYPES.STREAK_DAYS:
      return evalStreakDays(badge, stats);
    case BADGE_TRIGGER_TYPES.DISTANCE_REPEAT:
      return evalDistanceRepeat(badge, stats);
    default:
      return { earned: false, progress: null };
  }
}

function evalSessionBestThreshold(badge, stats) {
  const metricName = badge.metric;
  const sport = badge.sport || null;

  const raw = stats && metricName ? stats[metricName] : null;

  let value = 0;
  if (raw != null) {
    if (sport && typeof raw === "object") {
      value = Number(raw[sport]) || 0;
    } else if (typeof raw === "number") {
      value = raw;
    }
  }

  const target = badge.threshold ?? 0;
  const earned = value >= target;

  return {
    earned,
    progress: {
      current: clamp(value, 0, target),
      target,
    },
  };
}

function evalStreakDays(badge, stats) {
  const value = Number(stats?.streakDays || 0);
  const target = badge.threshold ?? 0;
  const earned = value >= target;

  return {
    earned,
    progress: {
      current: clamp(value, 0, target),
      target,
    },
  };
}

function evalDistanceRepeat(badge, stats) {
  const sport = badge.sport;
  const bucketKey = String(badge.distanceKm);
  const countsBySportAndBucket =
    stats?.distanceSessionCountsBySportAndBucket || {};
  const sportCounts = countsBySportAndBucket[sport] || {};
  const value = sportCounts[bucketKey] || 0;

  const target = badge.requiredCount ?? 1;
  const earned = value >= target;

  return {
    earned,
    progress: {
      current: clamp(value, 0, target),
      target,
    },
  };
}

function clamp(num, min, max) {
  if (max <= min) return num;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}
