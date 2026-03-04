// src/config/badges.js
// Badge ecosystem config (V2).
// - Plaque is NOT an SVG: tier label remains UI pill.
// - Icons are PNGs: /public/badges/icons/
// - Backgrounds are SVGs: /public/badges/bg/bg_<family>_<tier>.svg
//
// Exports:
// - BADGE_CARDS: cards for UI rendering
// - BADGE_DEFS: flattened tier defs for stacked badge renderer
// - ALL_BADGE_KEYS: Set for validation

export const TIERS = ["bronze", "silver", "gold", "platinum", "diamond"];

export const COMPARATOR = {
  GTE: "gte",
  LTE: "lte", // for time-based badges (lower is better)
};

export function bgPath(family, tier) {
  return `/badges/bg/bg_${family}_${tier}.svg`;
}

export function iconPath(iconFilePng) {
  return `/badges/icons/${iconFilePng}`;
}

export function formatTimeMMSS(totalSec) {
  if (totalSec == null || Number.isNaN(Number(totalSec))) return "—";
  const sec = Math.max(0, Math.round(Number(totalSec)));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Create tier defs for stacked renderer + tier rules for pills/logic
function makeTierDefs({ idPrefix, title, desc, family, iconFile, tiers }) {
  const tierDefs = tiers.map((t, idx) => ({
    key: `${idPrefix}_${idx + 1}`,
    title,
    desc,
    category: family,
    tier: t.tier,
    bg: bgPath(family, t.tier),
    icon: iconPath(iconFile),
    xp: t.xp,
    hidden: !!t.hidden,
  }));

  const tierRules = tiers.map((t, idx) => ({
    key: `${idPrefix}_${idx + 1}`,
    tier: t.tier,
    threshold: t.threshold,
    xp: t.xp,
    hidden: !!t.hidden,
  }));

  return { tierDefs, tierRules };
}

export const BADGE_CARDS = [];
const ALL_DEFS = [];
const ALL_KEYS = [];

function addCard(card, tierDefs) {
  BADGE_CARDS.push(card);
  for (const d of tierDefs) {
    ALL_DEFS.push(d);
    ALL_KEYS.push(d.key);
  }
}

// -------------------------------------------------------------
// Shared tier scheme for repetition badges (same as your current run badges vibe)
// -------------------------------------------------------------
const REP_TIERS = [
  { tier: "bronze", threshold: 1, xp: 25 },
  { tier: "silver", threshold: 3, xp: 35, hidden: true },
  { tier: "gold", threshold: 5, xp: 45 },
  { tier: "platinum", threshold: 10, xp: 60, hidden: true },
  { tier: "diamond", threshold: 25, xp: 80, hidden: true },
];

// -------------------------------------------------------------
// SPORT PACKS (distances + pace targets)
// Keys must match stats engine outputs exactly.
// -------------------------------------------------------------
//
// Distance keys chosen to be sport-relevant:
// - Run: classic road distances
// - Bike: common TT/sportive distances in km
// - Walk: common walking challenges incl. 50k
// - Row: common erg distances incl. HM + marathon
// - Swim: common open-water distances
//
// Pace badges use 3 benchmark distances per sport that people actually chase.
//
// Pace tier thresholds are TIME IN SECONDS (lower is better).
// These are designed as: Bronze=achievable, Gold=solid, Diamond=serious push.

const SPORT_PACKS = {
  run: {
    label: "Run",
    distances: [
      { key: "5k", label: "5K", km: 5 },
      { key: "10k", label: "10K", km: 10 },
      { key: "15k", label: "15K", km: 15 },
      { key: "half", label: "Half Marathon", km: 21.1 },
      { key: "30k", label: "30K", km: 30 },
      { key: "marathon", label: "Marathon", km: 42.195 },
      { key: "ultra50", label: "Ultra 50K", km: 50 },
    ],
    paceBadges: [
      {
        key: "5k",
        label: "5K",
        tiers: [
          { tier: "bronze", threshold: 35 * 60, xp: 25 },
          { tier: "silver", threshold: 30 * 60, xp: 35, hidden: true },
          { tier: "gold", threshold: 25 * 60, xp: 45 },
          { tier: "platinum", threshold: 22 * 60, xp: 60, hidden: true },
          { tier: "diamond", threshold: 19 * 60, xp: 80, hidden: true },
        ],
      },
      {
        key: "10k",
        label: "10K",
        tiers: [
          { tier: "bronze", threshold: 75 * 60, xp: 25 },
          { tier: "silver", threshold: 65 * 60, xp: 35, hidden: true },
          { tier: "gold", threshold: 55 * 60, xp: 45 },
          { tier: "platinum", threshold: 50 * 60, xp: 60, hidden: true },
          { tier: "diamond", threshold: 45 * 60, xp: 80, hidden: true },
        ],
      },
      {
        key: "half",
        label: "Half Marathon",
        tiers: [
          { tier: "bronze", threshold: (2 * 60 + 30) * 60, xp: 25 }, // 2:30
          { tier: "silver", threshold: (2 * 60 + 10) * 60, xp: 35, hidden: true }, // 2:10
          { tier: "gold", threshold: (1 * 60 + 55) * 60, xp: 45 }, // 1:55
          { tier: "platinum", threshold: (1 * 60 + 45) * 60, xp: 60, hidden: true }, // 1:45
          { tier: "diamond", threshold: (1 * 60 + 35) * 60, xp: 80, hidden: true }, // 1:35
        ],
      },
    ],
  },

  bike: {
    label: "Bike",
    distances: [
      { key: "10k", label: "10K", km: 10 },
      { key: "20k", label: "20K", km: 20 },
      { key: "40k", label: "40K", km: 40 },
      { key: "60k", label: "60K", km: 60 },
      { key: "100k", label: "100K", km: 100 },
      { key: "160k", label: "160K", km: 160 }, // ~100 miles sportive
      { key: "250k", label: "250K", km: 250 }, // big endurance day
    ],
    paceBadges: [
      {
        key: "20k",
        label: "20K",
        tiers: [
          { tier: "bronze", threshold: 55 * 60, xp: 25 },
          { tier: "silver", threshold: 48 * 60, xp: 35, hidden: true },
          { tier: "gold", threshold: 42 * 60, xp: 45 },
          { tier: "platinum", threshold: 37 * 60, xp: 60, hidden: true },
          { tier: "diamond", threshold: 33 * 60, xp: 80, hidden: true },
        ],
      },
      {
        key: "40k",
        label: "40K",
        tiers: [
          { tier: "bronze", threshold: 110 * 60, xp: 25 }, // 1:50
          { tier: "silver", threshold: 100 * 60, xp: 35, hidden: true }, // 1:40
          { tier: "gold", threshold: 90 * 60, xp: 45 }, // 1:30
          { tier: "platinum", threshold: 80 * 60, xp: 60, hidden: true }, // 1:20
          { tier: "diamond", threshold: 70 * 60, xp: 80, hidden: true }, // 1:10
        ],
      },
      {
        key: "100k",
        label: "100K",
        tiers: [
          { tier: "bronze", threshold: 240 * 60, xp: 25 }, // 4:00
          { tier: "silver", threshold: 210 * 60, xp: 35, hidden: true }, // 3:30
          { tier: "gold", threshold: 190 * 60, xp: 45 }, // 3:10
          { tier: "platinum", threshold: 170 * 60, xp: 60, hidden: true }, // 2:50
          { tier: "diamond", threshold: 150 * 60, xp: 80, hidden: true }, // 2:30
        ],
      },
    ],
  },

  walk: {
    label: "Walk",
    distances: [
      { key: "3k", label: "3K", km: 3 },
      { key: "5k", label: "5K", km: 5 },
      { key: "10k", label: "10K", km: 10 },
      { key: "15k", label: "15K", km: 15 },
      { key: "half", label: "Half Marathon", km: 21.1 },
      { key: "marathon", label: "Marathon", km: 42.195 },
      { key: "50k", label: "50K", km: 50 },
    ],
    paceBadges: [
      {
        key: "5k",
        label: "5K",
        tiers: [
          { tier: "bronze", threshold: 60 * 60, xp: 25 },
          { tier: "silver", threshold: 52 * 60, xp: 35, hidden: true },
          { tier: "gold", threshold: 45 * 60, xp: 45 },
          { tier: "platinum", threshold: 40 * 60, xp: 60, hidden: true },
          { tier: "diamond", threshold: 35 * 60, xp: 80, hidden: true },
        ],
      },
      {
        key: "10k",
        label: "10K",
        tiers: [
          { tier: "bronze", threshold: 130 * 60, xp: 25 }, // 2:10
          { tier: "silver", threshold: 115 * 60, xp: 35, hidden: true }, // 1:55
          { tier: "gold", threshold: 100 * 60, xp: 45 }, // 1:40
          { tier: "platinum", threshold: 90 * 60, xp: 60, hidden: true }, // 1:30
          { tier: "diamond", threshold: 80 * 60, xp: 80, hidden: true }, // 1:20
        ],
      },
      {
        key: "half",
        label: "Half Marathon",
        tiers: [
          { tier: "bronze", threshold: 300 * 60, xp: 25 }, // 5:00
          { tier: "silver", threshold: 270 * 60, xp: 35, hidden: true }, // 4:30
          { tier: "gold", threshold: 240 * 60, xp: 45 }, // 4:00
          { tier: "platinum", threshold: 210 * 60, xp: 60, hidden: true }, // 3:30
          { tier: "diamond", threshold: 180 * 60, xp: 80, hidden: true }, // 3:00
        ],
      },
    ],
  },

  row: {
    label: "Row",
    distances: [
      { key: "500m", label: "500m", km: 0.5 },
      { key: "1k", label: "1K", km: 1 },
      { key: "2k", label: "2K", km: 2 },
      { key: "5k", label: "5K", km: 5 },
      { key: "10k", label: "10K", km: 10 },
      { key: "half", label: "Half Marathon", km: 21.097 },
      { key: "marathon", label: "Marathon", km: 42.195 },
    ],
    paceBadges: [
      {
        key: "2k",
        label: "2K",
        tiers: [
          { tier: "bronze", threshold: 9 * 60 + 30, xp: 25 },  // 9:30
          { tier: "silver", threshold: 8 * 60 + 30, xp: 35, hidden: true }, // 8:30
          { tier: "gold", threshold: 7 * 60 + 30, xp: 45 }, // 7:30
          { tier: "platinum", threshold: 6 * 60 + 50, xp: 60, hidden: true }, // 6:50
          { tier: "diamond", threshold: 6 * 60 + 20, xp: 80, hidden: true }, // 6:20
        ],
      },
      {
        key: "5k",
        label: "5K",
        tiers: [
          { tier: "bronze", threshold: 24 * 60, xp: 25 },
          { tier: "silver", threshold: 22 * 60, xp: 35, hidden: true },
          { tier: "gold", threshold: 20 * 60, xp: 45 },
          { tier: "platinum", threshold: 18 * 60 + 30, xp: 60, hidden: true },
          { tier: "diamond", threshold: 17 * 60 + 30, xp: 80, hidden: true },
        ],
      },
      {
        key: "10k",
        label: "10K",
        tiers: [
          { tier: "bronze", threshold: 52 * 60, xp: 25 },
          { tier: "silver", threshold: 48 * 60, xp: 35, hidden: true },
          { tier: "gold", threshold: 45 * 60, xp: 45 },
          { tier: "platinum", threshold: 42 * 60, xp: 60, hidden: true },
          { tier: "diamond", threshold: 39 * 60, xp: 80, hidden: true },
        ],
      },
    ],
  },

  swim: {
    label: "Swim",
    distances: [
      { key: "200m", label: "200m", km: 0.2 },
      { key: "400m", label: "400m", km: 0.4 },
      { key: "750m", label: "750m", km: 0.75 },
      { key: "1500m", label: "1500m", km: 1.5 },
      { key: "3k", label: "3K", km: 3 },
      { key: "5k", label: "5K", km: 5 },
      { key: "10k", label: "10K", km: 10 },
    ],
    paceBadges: [
      {
        key: "750m",
        label: "750m",
        tiers: [
          { tier: "bronze", threshold: 18 * 60, xp: 25 },
          { tier: "silver", threshold: 16 * 60, xp: 35, hidden: true },
          { tier: "gold", threshold: 14 * 60 + 30, xp: 45 },
          { tier: "platinum", threshold: 13 * 60, xp: 60, hidden: true },
          { tier: "diamond", threshold: 11 * 60 + 30, xp: 80, hidden: true },
        ],
      },
      {
        key: "1500m",
        label: "1500m",
        tiers: [
          { tier: "bronze", threshold: 38 * 60, xp: 25 },
          { tier: "silver", threshold: 34 * 60, xp: 35, hidden: true },
          { tier: "gold", threshold: 30 * 60, xp: 45 },
          { tier: "platinum", threshold: 27 * 60, xp: 60, hidden: true },
          { tier: "diamond", threshold: 24 * 60, xp: 80, hidden: true },
        ],
      },
      {
        key: "3k",
        label: "3K",
        tiers: [
          { tier: "bronze", threshold: 80 * 60, xp: 25 },
          { tier: "silver", threshold: 70 * 60, xp: 35, hidden: true },
          { tier: "gold", threshold: 62 * 60, xp: 45 },
          { tier: "platinum", threshold: 55 * 60, xp: 60, hidden: true },
          { tier: "diamond", threshold: 48 * 60, xp: 80, hidden: true },
        ],
      },
    ],
  },
};

// -------------------------------------------------------------
// KEPT non-cardio badges (your list)
// -------------------------------------------------------------

// 1) Total Volume Lifted
{
  const idPrefix = "badge_volume_kg";
  const title = "Total Volume";
  const desc = "Lifetime volume lifted (kg)";
  const family = "volume";
  const iconFile = "icon_volume.png";

  const tiers = [
    { tier: "bronze", threshold: 1000, xp: 25 },
    { tier: "silver", threshold: 5000, xp: 35, hidden: true },
    { tier: "gold", threshold: 20000, xp: 45 },
    { tier: "platinum", threshold: 75000, xp: 60, hidden: true },
    { tier: "diamond", threshold: 200000, xp: 80, hidden: true },
  ];

  const { tierDefs, tierRules } = makeTierDefs({ idPrefix, title, desc, family, iconFile, tiers });

  addCard(
    {
      id: "volume_total_kg",
      title,
      desc,
      family,
      iconFile,
      statKey: "stats.lifts.totalVolumeKg",
      comparator: COMPARATOR.GTE,
      tiers: tierRules,
      getProgressText: ({ value, nextTier }) => {
        const v = Math.floor(safeNum(value));
        if (!nextTier) return `Total volume: ${v} kg.`;
        const remaining = Math.max(0, nextTier.threshold - v);
        return `Total volume: ${v} kg — ${remaining} kg to reach ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
      },
    },
    tierDefs
  );
}

// 2) Most Sets In a Session
{
  const idPrefix = "badge_session_sets";
  const title = "Session Builder";
  const desc = "Most strength sets in a session";
  const family = "performance";
  const iconFile = "icon_sets.png";

  const tiers = [
    { tier: "bronze", threshold: 10, xp: 25 },
    { tier: "silver", threshold: 20, xp: 35, hidden: true },
    { tier: "gold", threshold: 30, xp: 45 },
    { tier: "platinum", threshold: 40, xp: 60, hidden: true },
    { tier: "diamond", threshold: 50, xp: 80, hidden: true },
  ];

  const { tierDefs, tierRules } = makeTierDefs({ idPrefix, title, desc, family, iconFile, tiers });

  addCard(
    {
      id: "session_max_sets",
      title,
      desc,
      family,
      iconFile,
      statKey: "stats.sessions.maxStrengthSetsInSession",
      comparator: COMPARATOR.GTE,
      tiers: tierRules,
      getProgressText: ({ value, nextTier }) => {
        const v = Math.floor(safeNum(value));
        if (!nextTier) return `Max session sets: ${v}.`;
        const remaining = Math.max(0, nextTier.threshold - v);
        return `Max session sets: ${v} — ${remaining} more to reach ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
      },
    },
    tierDefs
  );
}

// 3) 1000 Total Sets
{
  const idPrefix = "badge_total_sets";
  const title = "Set Storm";
  const desc = "Total sets logged";
  const family = "intensity";
  const iconFile = "icon_setstorm.png";

  const tiers = [
    { tier: "bronze", threshold: 250, xp: 25 },
    { tier: "silver", threshold: 500, xp: 35, hidden: true },
    { tier: "gold", threshold: 1000, xp: 45 },
    { tier: "platinum", threshold: 2500, xp: 60, hidden: true },
    { tier: "diamond", threshold: 5000, xp: 80, hidden: true },
  ];

  const { tierDefs, tierRules } = makeTierDefs({ idPrefix, title, desc, family, iconFile, tiers });

  addCard(
    {
      id: "total_sets",
      title,
      desc,
      family,
      iconFile,
      statKey: "stats.lifts.totalSets",
      comparator: COMPARATOR.GTE,
      tiers: tierRules,
      getProgressText: ({ value, nextTier }) => {
        const v = Math.floor(safeNum(value));
        if (!nextTier) return `Total sets: ${v}.`;
        const remaining = Math.max(0, nextTier.threshold - v);
        return `Total sets: ${v} — ${remaining} to reach ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
      },
    },
    tierDefs
  );
}

// 4) 10,000 Total Reps
{
  const idPrefix = "badge_total_reps";
  const title = "Rep Wave";
  const desc = "Total reps logged";
  const family = "intensity";
  const iconFile = "icon_reps.png";

  const tiers = [
    { tier: "bronze", threshold: 1000, xp: 25 },
    { tier: "silver", threshold: 5000, xp: 35, hidden: true },
    { tier: "gold", threshold: 10000, xp: 45 },
    { tier: "platinum", threshold: 25000, xp: 60, hidden: true },
    { tier: "diamond", threshold: 50000, xp: 80, hidden: true },
  ];

  const { tierDefs, tierRules } = makeTierDefs({ idPrefix, title, desc, family, iconFile, tiers });

  addCard(
    {
      id: "total_reps",
      title,
      desc,
      family,
      iconFile,
      statKey: "stats.lifts.totalReps",
      comparator: COMPARATOR.GTE,
      tiers: tierRules,
      getProgressText: ({ value, nextTier }) => {
        const v = Math.floor(safeNum(value));
        if (!nextTier) return `Total reps: ${v}.`;
        const remaining = Math.max(0, nextTier.threshold - v);
        return `Total reps: ${v} — ${remaining} to reach ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
      },
    },
    tierDefs
  );
}

// 10) Early Bird (before cutoff; cutoff is age-based and exposed by stats engine)
{
  const idPrefix = "badge_early";
  const title = "Early Bird";
  const desc = "Train early";
  const family = "behaviour";
  const iconFile = "icon_earlybird.png";

  const tiers = [
    { tier: "bronze", threshold: 3, xp: 25 },
    { tier: "silver", threshold: 10, xp: 35, hidden: true },
    { tier: "gold", threshold: 25, xp: 45 },
    { tier: "platinum", threshold: 50, xp: 60, hidden: true },
    { tier: "diamond", threshold: 100, xp: 80, hidden: true },
  ];

  const { tierDefs, tierRules } = makeTierDefs({ idPrefix, title, desc, family, iconFile, tiers });

  addCard(
    {
      id: "early_bird",
      title,
      desc,
      family,
      iconFile,
      statKey: "stats.behaviour.earlyBirdSessions",
      comparator: COMPARATOR.GTE,
      tiers: tierRules,
      getProgressText: ({ value, nextTier, meta }) => {
        const v = Math.floor(safeNum(value));
        const cutoff = meta?.earlyCutoffHour ?? 8;
        if (!nextTier) return `Early sessions: ${v}.`;
        const remaining = Math.max(0, nextTier.threshold - v);
        return `Trained before ${cutoff}:00 — ${v} sessions · ${remaining} more to reach ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
      },
    },
    tierDefs
  );
}

// 11) Night Grinder (after cutoff; cutoff is age-based and exposed by stats engine)
{
  const idPrefix = "badge_night";
  const title = "Night Grinder";
  const desc = "Train late";
  const family = "behaviour";
  const iconFile = "icon_nightgrinder.png";

  const tiers = [
    { tier: "bronze", threshold: 3, xp: 25 },
    { tier: "silver", threshold: 10, xp: 35, hidden: true },
    { tier: "gold", threshold: 25, xp: 45 },
    { tier: "platinum", threshold: 50, xp: 60, hidden: true },
    { tier: "diamond", threshold: 100, xp: 80, hidden: true },
  ];

  const { tierDefs, tierRules } = makeTierDefs({ idPrefix, title, desc, family, iconFile, tiers });

  addCard(
    {
      id: "night_grinder",
      title,
      desc,
      family,
      iconFile,
      statKey: "stats.behaviour.nightSessions",
      comparator: COMPARATOR.GTE,
      tiers: tierRules,
      getProgressText: ({ value, nextTier, meta }) => {
        const v = Math.floor(safeNum(value));
        const cutoff = meta?.nightCutoffHour ?? 19;
        if (!nextTier) return `Night sessions: ${v}.`;
        const remaining = Math.max(0, nextTier.threshold - v);
        return `Trained after ${cutoff}:00 — ${v} sessions · ${remaining} more to reach ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
      },
    },
    tierDefs
  );
}

// 14) Progressive Overload Detected
{
  const idPrefix = "badge_overload";
  const title = "Progressive Overload";
  const desc = "Overload events detected";
  const family = "intelligence";
  const iconFile = "icon_overload.png";

  const tiers = [
    { tier: "bronze", threshold: 1, xp: 25 },
    { tier: "silver", threshold: 5, xp: 35, hidden: true },
    { tier: "gold", threshold: 15, xp: 45 },
    { tier: "platinum", threshold: 30, xp: 60, hidden: true },
    { tier: "diamond", threshold: 60, xp: 80, hidden: true },
  ];

  const { tierDefs, tierRules } = makeTierDefs({ idPrefix, title, desc, family, iconFile, tiers });

  addCard(
    {
      id: "progressive_overload",
      title,
      desc,
      family,
      iconFile,
      statKey: "stats.intelligence.progressiveOverloadEvents",
      comparator: COMPARATOR.GTE,
      tiers: tierRules,
      getProgressText: ({ value, nextTier }) => {
        const v = Math.floor(safeNum(value));
        if (!nextTier) return `Overload events: ${v}.`;
        const remaining = Math.max(0, nextTier.threshold - v);
        return `Overload events: ${v} — ${remaining} to reach ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
      },
    },
    tierDefs
  );
}

// 15) Pace Improvement (global best improvement across sports)
{
  const idPrefix = "badge_pace_imp";
  const title = "Pace Improvement";
  const desc = "Improve your pace vs baseline (4 weeks)";
  const family = "improvement";
  const iconFile = "icon_paceimprove.png";

  const tiers = [
    { tier: "bronze", threshold: 3, xp: 25 },
    { tier: "silver", threshold: 5, xp: 35, hidden: true },
    { tier: "gold", threshold: 8, xp: 45 },
    { tier: "platinum", threshold: 12, xp: 60, hidden: true },
    { tier: "diamond", threshold: 15, xp: 80, hidden: true },
  ];

  const { tierDefs, tierRules } = makeTierDefs({ idPrefix, title, desc, family, iconFile, tiers });

  addCard(
    {
      id: "pace_improvement",
      title,
      desc,
      family,
      iconFile,
      statKey: "stats.intelligence.paceImprovementPct4w",
      comparator: COMPARATOR.GTE,
      tiers: tierRules,
      getProgressText: ({ value, nextTier, meta }) => {
        const v = Math.round(safeNum(value) * 10) / 10;
        const sport = meta?.paceImprovementSport ? String(meta.paceImprovementSport).toUpperCase() : null;
        if (!nextTier) return `Pace improvement: ${v}%${sport ? ` (${sport})` : ""}.`;
        const remaining = Math.max(0, nextTier.threshold - v);
        return `Pace improvement: ${v}%${sport ? ` (${sport})` : ""} — ${remaining}% to reach ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
      },
    },
    tierDefs
  );
}

// -------------------------------------------------------------
// CARDIO BADGES (repetition + pace) for every sport pack above
// -------------------------------------------------------------
function addCardioDistanceRepetitionBadges() {
  for (const sport of Object.keys(SPORT_PACKS)) {
    const pack = SPORT_PACKS[sport];

    for (const d of pack.distances) {
      const idPrefix = `badge_${sport}_${d.key}_count`;
      const title = `${pack.label} ${d.label}`;
      const desc = `Logged ${d.label}+ (${pack.label})`;
      const family = "performance";
      const iconFile = `icon_${sport}_${d.key}.png`;

      const { tierDefs, tierRules } = makeTierDefs({
        idPrefix,
        title,
        desc,
        family,
        iconFile,
        tiers: REP_TIERS,
      });

      addCard(
        {
          id: `${sport}_${d.key}_count`,
          title,
          desc,
          family,
          iconFile,
          statKey: `stats.cardio.${sport}.count.${d.key}`,
          comparator: COMPARATOR.GTE,
          tiers: tierRules,
          getProgressText: ({ value, nextTier }) => {
            const v = Math.floor(safeNum(value));
            if (!nextTier) return `Logged ${d.label}+ · ${v} times.`;
            const remaining = Math.max(0, nextTier.threshold - v);
            return `Logged ${d.label}+ · ${v} times — ${remaining} more to reach ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
          },
        },
        tierDefs
      );
    }
  }
}

function addCardioPaceBadges() {
  for (const sport of Object.keys(SPORT_PACKS)) {
    const pack = SPORT_PACKS[sport];

    for (const p of pack.paceBadges) {
      const idPrefix = `badge_${sport}_${p.key}_pace`;
      const title = `${pack.label} ${p.label} Pace`;
      const desc = `Fastest ${p.label} time (${pack.label})`;
      const family = "performance";
      const iconFile = `icon_${sport}_${p.key}_pace.png`;

      const { tierDefs, tierRules } = makeTierDefs({
        idPrefix,
        title,
        desc,
        family,
        iconFile,
        tiers: p.tiers,
      });

      addCard(
        {
          id: `${sport}_${p.key}_best_time`,
          title,
          desc,
          family,
          iconFile,
          statKey: `stats.cardio.${sport}.bestTimeSec.${p.key}`,
          comparator: COMPARATOR.LTE,
          tiers: tierRules,
          getProgressText: ({ value, nextTier }) => {
            const v = value == null ? null : safeNum(value);
            if (v == null || v <= 0) return `Log ${p.label}+ with time to start tracking pace.`;
            if (!nextTier) return `Best ${p.label}: ${formatTimeMMSS(v)}.`;
            return `Best ${p.label}: ${formatTimeMMSS(v)} — beat ${formatTimeMMSS(nextTier.threshold)} for ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
          },
        },
        tierDefs
      );
    }
  }
}

addCardioDistanceRepetitionBadges();
addCardioPaceBadges();

export const BADGE_DEFS = ALL_DEFS;
export const ALL_BADGE_KEYS = new Set(ALL_KEYS);
