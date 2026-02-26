// src/config/badges.js

// Trigger types for the generic BadgeEngine
export const BADGE_TRIGGER_TYPES = {
  SESSION_BEST_THRESHOLD: "SESSION_BEST_THRESHOLD", // best single session distance / speed
  STREAK_DAYS: "STREAK_DAYS",                      // consecutive active days
};

// Sports keys – keep in sync with cardioType values
export const SPORTS = {
  RUN: "run",
  BIKE: "bike",
  WALK: "walk",
  SWIM: "swim",
  ROW: "row",
};

// Core badge definitions for the new engine.
// These are *performance* badges – single-session distance/speed + streaks.
// You can extend this file with more badges in the same pattern.
export const badgeDefinitions = [
  // ─────────────────────────────
  // RUNNING DISTANCE – single session
  // ─────────────────────────────
  {
    id: "run_5k_single",
    family: "volume",
    rarity: "bronze",
    title: "5K Run",
    description: "Completed a single run of 5 km or more.",
    sport: SPORTS.RUN,
    triggerType: BADGE_TRIGGER_TYPES.SESSION_BEST_THRESHOLD,
    metric: "bestDistanceBySport", // stats[metric][sport]
    threshold: 5, // km
    sortOrder: 10,
  },
  {
    id: "run_10k_single",
    family: "volume",
    rarity: "silver",
    title: "10K Run",
    description: "Completed a single run of 10 km or more.",
    sport: SPORTS.RUN,
    triggerType: BADGE_TRIGGER_TYPES.SESSION_BEST_THRESHOLD,
    metric: "bestDistanceBySport",
    threshold: 10,
    sortOrder: 11,
  },
  {
    id: "run_15k_single",
    family: "volume",
    rarity: "gold",
    title: "15K Run",
    description: "Completed a single run of 15 km or more.",
    sport: SPORTS.RUN,
    triggerType: BADGE_TRIGGER_TYPES.SESSION_BEST_THRESHOLD,
    metric: "bestDistanceBySport",
    threshold: 15,
    sortOrder: 12,
  },
  {
    id: "run_half_marathon_single",
    family: "volume",
    rarity: "platinum",
    title: "Half Marathon",
    description: "Completed a single run of 21.1 km or more.",
    sport: SPORTS.RUN,
    triggerType: BADGE_TRIGGER_TYPES.SESSION_BEST_THRESHOLD,
    metric: "bestDistanceBySport",
    threshold: 21.1,
    sortOrder: 13,
  },

  // ─────────────────────────────
  // CYCLING DISTANCE – single session
  // ─────────────────────────────
  ...[5, 10, 20, 30, 50, 75, 100, 150, 200].map((km, index) => {
    const labels = {
      5: { rarity: "bronze", title: "5K Ride" },
      10: { rarity: "bronze", title: "10K Ride" },
      20: { rarity: "silver", title: "20K Ride" },
      30: { rarity: "silver", title: "30K Ride" },
      50: { rarity: "gold", title: "50K Ride" },
      75: { rarity: "gold", title: "75K Ride" },
      100: { rarity: "platinum", title: "Century Ride" },
      150: { rarity: "diamond", title: "150K Ride" },
      200: { rarity: "mythic", title: "200K Ride" },
    }[km];

    return {
      id: `bike_${km}k_single`,
      family: "volume",
      rarity: labels.rarity,
      title: labels.title,
      description: `Completed a single bike ride of ${km} km or more.`,
      sport: SPORTS.BIKE,
      triggerType: BADGE_TRIGGER_TYPES.SESSION_BEST_THRESHOLD,
      metric: "bestDistanceBySport",
      threshold: km,
      sortOrder: 20 + index,
    };
  }),

  // ─────────────────────────────
  // RUNNING SPEED – best avg speed in any run
  // ─────────────────────────────
  {
    id: "run_speed_good",
    family: "speed",
    rarity: "bronze",
    title: "Quick Feet",
    description:
      "Hit an average running speed of 14 km/h or more in a single run.",
    sport: SPORTS.RUN,
    triggerType: BADGE_TRIGGER_TYPES.SESSION_BEST_THRESHOLD,
    metric: "bestAvgSpeedBySport",
    threshold: 14,
    sortOrder: 40,
  },
  {
    id: "run_speed_great",
    family: "speed",
    rarity: "silver",
    title: "Fast Feet",
    description:
      "Hit an average running speed of 16 km/h or more in a single run.",
    sport: SPORTS.RUN,
    triggerType: BADGE_TRIGGER_TYPES.SESSION_BEST_THRESHOLD,
    metric: "bestAvgSpeedBySport",
    threshold: 16,
    sortOrder: 41,
  },
  {
    id: "run_speed_outstanding",
    family: "speed",
    rarity: "gold",
    title: "Blazing Pace",
    description:
      "Hit an average running speed of 18 km/h or more in a single run.",
    sport: SPORTS.RUN,
    triggerType: BADGE_TRIGGER_TYPES.SESSION_BEST_THRESHOLD,
    metric: "bestAvgSpeedBySport",
    threshold: 18,
    sortOrder: 42,
  },

  // ─────────────────────────────
  // CYCLING SPEED – best avg speed tiers (km/h equivalent of 14–22 mph)
  // ─────────────────────────────
  {
    id: "bike_speed_good",
    family: "speed",
    rarity: "bronze",
    title: "Solid Spinner",
    description:
      "Hit an average cycling speed of 22.5 km/h (14 mph) or more in a ride.",
    sport: SPORTS.BIKE,
    triggerType: BADGE_TRIGGER_TYPES.SESSION_BEST_THRESHOLD,
    metric: "bestAvgSpeedBySport",
    threshold: 22.5,
    sortOrder: 50,
  },
  {
    id: "bike_speed_great",
    family: "speed",
    rarity: "silver",
    title: "Strong Spinner",
    description:
      "Hit an average cycling speed of 26 km/h (16 mph) or more in a ride.",
    sport: SPORTS.BIKE,
    triggerType: BADGE_TRIGGER_TYPES.SESSION_BEST_THRESHOLD,
    metric: "bestAvgSpeedBySport",
    threshold: 26,
    sortOrder: 51,
  },
  {
    id: "bike_speed_outstanding",
    family: "speed",
    rarity: "gold",
    title: "Speed Machine",
    description:
      "Hit an average cycling speed of 29 km/h (18 mph) or more in a ride.",
    sport: SPORTS.BIKE,
    triggerType: BADGE_TRIGGER_TYPES.SESSION_BEST_THRESHOLD,
    metric: "bestAvgSpeedBySport",
    threshold: 29,
    sortOrder: 52,
  },
  {
    id: "bike_speed_pro",
    family: "speed",
    rarity: "platinum",
    title: "Pro Pace",
    description:
      "Hit an average cycling speed of 32 km/h (20 mph) or more in a ride.",
    sport: SPORTS.BIKE,
    triggerType: BADGE_TRIGGER_TYPES.SESSION_BEST_THRESHOLD,
    metric: "bestAvgSpeedBySport",
    threshold: 32,
    sortOrder: 53,
  },
  {
    id: "bike_speed_elite",
    family: "speed",
    rarity: "diamond",
    title: "Elite Pace",
    description:
      "Hit an average cycling speed of 35 km/h (22 mph) or more in a ride.",
    sport: SPORTS.BIKE,
    triggerType: BADGE_TRIGGER_TYPES.SESSION_BEST_THRESHOLD,
    metric: "bestAvgSpeedBySport",
    threshold: 35,
    sortOrder: 54,
  },

  // ─────────────────────────────
  // STREAK BADGES – Fortnite / Rocket League style naming
  // ─────────────────────────────
  {
    id: "streak_3",
    family: "consistency",
    rarity: "bronze",
    title: "3-Day Streak",
    description: "Trained 3 days in a row.",
    triggerType: BADGE_TRIGGER_TYPES.STREAK_DAYS,
    threshold: 3,
    sortOrder: 100,
  },
  {
    id: "streak_7",
    family: "consistency",
    rarity: "silver",
    title: "7-Day Streak",
    description: "Trained 7 days in a row.",
    triggerType: BADGE_TRIGGER_TYPES.STREAK_DAYS,
    threshold: 7,
    sortOrder: 101,
  },
  {
    id: "streak_14",
    family: "consistency",
    rarity: "gold",
    title: "14-Day Streak",
    description: "Trained 14 days in a row.",
    triggerType: BADGE_TRIGGER_TYPES.STREAK_DAYS,
    threshold: 14,
    sortOrder: 102,
  },
  {
    id: "streak_30",
    family: "consistency",
    rarity: "platinum",
    title: "30-Day Streak",
    description: "Trained 30 days in a row.",
    triggerType: BADGE_TRIGGER_TYPES.STREAK_DAYS,
    threshold: 30,
    sortOrder: 103,
  },
  {
    id: "streak_60",
    family: "consistency",
    rarity: "diamond",
    title: "60-Day Streak",
    description: "Trained 60 days in a row.",
    triggerType: BADGE_TRIGGER_TYPES.STREAK_DAYS,
    threshold: 60,
    sortOrder: 104,
  },
  {
    id: "streak_90_mythic",
    family: "consistency",
    rarity: "mythic",
    title: "Mythic Streak",
    description: "Trained 90 days in a row.",
    triggerType: BADGE_TRIGGER_TYPES.STREAK_DAYS,
    threshold: 90,
    sortOrder: 105,
  },
  {
    id: "streak_180_ssl",
    family: "consistency",
    rarity: "ssl",
    title: "Super Sonic Legend",
    description: "Trained 180 days in a row.",
    triggerType: BADGE_TRIGGER_TYPES.STREAK_DAYS,
    threshold: 180,
    sortOrder: 106,
  },
  {
    id: "streak_365_unreal",
    family: "consistency",
    rarity: "unreal",
    title: "Unreal Streak",
    description: "Trained 365 days in a row.",
    triggerType: BADGE_TRIGGER_TYPES.STREAK_DAYS,
    threshold: 365,
    sortOrder: 107,
  },
];