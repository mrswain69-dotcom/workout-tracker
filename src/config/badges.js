// src/config/badges.js
// V2 unified badge ecosystem config.
// Keeps current UI system: title, stacked badge, claim/claimed, dynamic progress text, tier pills.
// NOTE: No plaque SVGs. The tier plaque remains the existing pill UI in App.jsx.
// Icons are PNGs.

export const TIERS = ["bronze", "silver", "gold", "platinum", "diamond"];

export const COMPARATOR = {
  GTE: "gte", // value >= threshold
  LTE: "lte", // value <= threshold (lower is better)
};

// Background convention: /badges/bg/bg_{family}_{tier}.svg
export function bgPath(family, tier) {
  return `/badges/bg/bg_${family}_${tier}.svg`;
}

// Icon convention: /badges/icons/{iconFile}.png
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

// Build tiers + defs in the same style as runBadgesV1
function makeTierDefs({
  idPrefix,
  title,
  desc,
  family,        // e.g. "volume", "performance", "intensity", "consistency"
  iconFile,      // e.g. "icon_volume.png"
  tiers,         // [{ tier, threshold, xp, hidden? }]
}) {
  const tierDefs = tiers.map((t, idx) => ({
    key: `${idPrefix}_${idx + 1}`,     // e.g. badge_volume_kg_1
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

// ---------------------------------------------------------------------------
// V2 BADGE CARDS (each one should render as a card like your 5K / 10K)
// ---------------------------------------------------------------------------
// statKey = the stats engine output key we will read (later)
// comparator = gte or lte
// getProgressText = function used by the description block in the card UI
//
// When wiring, App.jsx will:
// - compute value from stats via statKey
// - compute earned tier + next tier
// - show "Logged X — Y more..." etc using getProgressText
// ---------------------------------------------------------------------------

export const BADGE_CARDS = [];

// We'll collect all stacked defs here (like runBadgesV1 BADGE_DEFS)
const ALL_DEFS = [];
const ALL_KEYS = [];

// Helper to push a card + add its tier defs into BADGE_DEFS
function addCard(card, tierDefs) {
  BADGE_CARDS.push(card);
  for (const d of tierDefs) {
    ALL_DEFS.push(d);
    ALL_KEYS.push(d.key);
  }
}

// =====================
// 15 NEW BADGES
// =====================

// 1) Total Volume Lifted
{
  const idPrefix = "badge_volume_kg";
  const title = "Total Volume";
  const desc = "Lifetime volume lifted (kg)";
  const family = "volume";
  const iconFile = "icon_volume.png";

  const tiers = [
    { tier: "bronze",   threshold: 1000,   xp: 25 },
    { tier: "silver",   threshold: 5000,   xp: 35, hidden: true },
    { tier: "gold",     threshold: 20000,  xp: 45 },
    { tier: "platinum", threshold: 75000,  xp: 60, hidden: true },
    { tier: "diamond",  threshold: 200000, xp: 80, hidden: true },
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

// 2) Most Sets in a Session
{
  const idPrefix = "badge_session_sets";
  const title = "Session Builder";
  const desc = "Most strength sets in a session";
  const family = "performance";
  const iconFile = "icon_sets.png";

  const tiers = [
    { tier: "bronze",   threshold: 10, xp: 25 },
    { tier: "silver",   threshold: 20, xp: 35, hidden: true },
    { tier: "gold",     threshold: 30, xp: 45 },
    { tier: "platinum", threshold: 40, xp: 60, hidden: true },
    { tier: "diamond",  threshold: 50, xp: 80, hidden: true },
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

// 3) Total Sets
{
  const idPrefix = "badge_total_sets";
  const title = "Set Storm";
  const desc = "Total sets logged";
  const family = "intensity";
  const iconFile = "icon_setstorm.png";

  const tiers = [
    { tier: "bronze",   threshold: 250,  xp: 25 },
    { tier: "silver",   threshold: 500,  xp: 35, hidden: true },
    { tier: "gold",     threshold: 1000, xp: 45 },
    { tier: "platinum", threshold: 2500, xp: 60, hidden: true },
    { tier: "diamond",  threshold: 5000, xp: 80, hidden: true },
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

// 4) Total Reps
{
  const idPrefix = "badge_total_reps";
  const title = "Rep Wave";
  const desc = "Total reps logged";
  const family = "intensity";
  const iconFile = "icon_reps.png";

  const tiers = [
    { tier: "bronze",   threshold: 1000,  xp: 25 },
    { tier: "silver",   threshold: 5000,  xp: 35, hidden: true },
    { tier: "gold",     threshold: 10000, xp: 45 },
    { tier: "platinum", threshold: 25000, xp: 60, hidden: true },
    { tier: "diamond",  threshold: 50000, xp: 80, hidden: true },
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

// 5) Longest Cardio Duration
{
  const idPrefix = "badge_cardio_long";
  const title = "Endurance Arc";
  const desc = "Longest cardio duration";
  const family = "performance";
  const iconFile = "icon_endurance.png";

  const tiers = [
    { tier: "bronze",   threshold: 20, xp: 25 },
    { tier: "silver",   threshold: 30, xp: 35, hidden: true },
    { tier: "gold",     threshold: 45, xp: 45 },
    { tier: "platinum", threshold: 60, xp: 60, hidden: true },
    { tier: "diamond",  threshold: 90, xp: 80, hidden: true },
  ];

  const { tierDefs, tierRules } = makeTierDefs({ idPrefix, title, desc, family, iconFile, tiers });

  addCard(
    {
      id: "cardio_longest_duration",
      title,
      desc,
      family,
      iconFile,
      statKey: "stats.cardio.longestDurationMin",
      comparator: COMPARATOR.GTE,
      tiers: tierRules,
      getProgressText: ({ value, nextTier }) => {
        const v = Math.floor(safeNum(value));
        if (!nextTier) return `Longest cardio: ${v} min.`;
        const remaining = Math.max(0, nextTier.threshold - v);
        return `Longest cardio: ${v} min — ${remaining} min to reach ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
      },
    },
    tierDefs
  );
}

// 6) Fastest 5K Time (lower is better)
{
  const idPrefix = "badge_5k_pace";
  const title = "5K Pace";
  const desc = "Fastest 5K time";
  const family = "performance";
  const iconFile = "icon_5kpace.png";

  const tiers = [
    { tier: "bronze",   threshold: 30 * 60,      xp: 25 },
    { tier: "silver",   threshold: 27 * 60 + 30, xp: 35, hidden: true },
    { tier: "gold",     threshold: 25 * 60,      xp: 45 },
    { tier: "platinum", threshold: 22 * 60 + 30, xp: 60, hidden: true },
    { tier: "diamond",  threshold: 20 * 60,      xp: 80, hidden: true },
  ];

  const { tierDefs, tierRules } = makeTierDefs({ idPrefix, title, desc, family, iconFile, tiers });

  addCard(
    {
      id: "cardio_best_5k_time",
      title,
      desc,
      family,
      iconFile,
      statKey: "stats.cardio.best5kTimeSec",
      comparator: COMPARATOR.LTE,
      tiers: tierRules,
      getProgressText: ({ value, nextTier }) => {
        const v = value == null ? null : safeNum(value);
        if (v == null || v <= 0) return "Log a 5K+ run with time to start tracking pace.";
        if (!nextTier) return `Best 5K: ${formatTimeMMSS(v)}.`;
        return `Best 5K: ${formatTimeMMSS(v)} — beat ${formatTimeMMSS(nextTier.threshold)} for ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
      },
    },
    tierDefs
  );
}

// 7) Weekly Consistency Score
{
  const idPrefix = "badge_week_score";
  const title = "Weekly Consistency";
  const desc = "Consistency score (last 7 days)";
  const family = "consistency";
  const iconFile = "icon_consistency.png";

  const tiers = [
    { tier: "bronze",   threshold: 80,  xp: 25 },
    { tier: "silver",   threshold: 90,  xp: 35, hidden: true },
    { tier: "gold",     threshold: 95,  xp: 45 },
    { tier: "platinum", threshold: 100, xp: 60, hidden: true },
    { tier: "diamond",  threshold: 100, xp: 80, hidden: true },
  ];

  const { tierDefs, tierRules } = makeTierDefs({ idPrefix, title, desc, family, iconFile, tiers });

  addCard(
    {
      id: "week_score",
      title,
      desc,
      family,
      iconFile,
      statKey: "stats.consistency.weekScorePct",
      comparator: COMPARATOR.GTE,
      tiers: tierRules,
      getProgressText: ({ value, nextTier }) => {
        const v = Math.round(safeNum(value));
        if (!nextTier) return `Weekly score: ${v}%.`;
        const remaining = Math.max(0, nextTier.threshold - v);
        return `Weekly score: ${v}% — ${remaining}% to reach ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
      },
    },
    tierDefs
  );
}

// 8) Plan Adherence % (30d)
{
  const idPrefix = "badge_adherence";
  const title = "Plan Adherence";
  const desc = "Adherence to your plan (last 30 days)";
  const family = "behaviour";
  const iconFile = "icon_adherence.png";

  const tiers = [
    { tier: "bronze",   threshold: 70, xp: 25 },
    { tier: "silver",   threshold: 80, xp: 35, hidden: true },
    { tier: "gold",     threshold: 90, xp: 45 },
    { tier: "platinum", threshold: 95, xp: 60, hidden: true },
    { tier: "diamond",  threshold: 98, xp: 80, hidden: true },
  ];

  const { tierDefs, tierRules } = makeTierDefs({ idPrefix, title, desc, family, iconFile, tiers });

  addCard(
    {
      id: "adherence_30d",
      title,
      desc,
      family,
      iconFile,
      statKey: "stats.behaviour.planAdherencePct30d",
      comparator: COMPARATOR.GTE,
      tiers: tierRules,
      getProgressText: ({ value, nextTier }) => {
        const v = Math.round(safeNum(value));
        if (!nextTier) return `Adherence: ${v}%.`;
        const remaining = Math.max(0, nextTier.threshold - v);
        return `Adherence: ${v}% — ${remaining}% to reach ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
      },
    },
    tierDefs
  );
}

// 9) Perfect Form Sessions (30d)
{
  const idPrefix = "badge_perfect_form";
  const title = "Perfect Form";
  const desc = "Sessions with complete logging (last 30 days)";
  const family = "behaviour";
  const iconFile = "icon_perfectform.png";

  const tiers = [
    { tier: "bronze",   threshold: 3,  xp: 25 },
    { tier: "silver",   threshold: 7,  xp: 35, hidden: true },
    { tier: "gold",     threshold: 15, xp: 45 },
    { tier: "platinum", threshold: 25, xp: 60, hidden: true },
    { tier: "diamond",  threshold: 40, xp: 80, hidden: true },
  ];

  const { tierDefs, tierRules } = makeTierDefs({ idPrefix, title, desc, family, iconFile, tiers });

  addCard(
    {
      id: "perfect_form_30d",
      title,
      desc,
      family,
      iconFile,
      statKey: "stats.behaviour.perfectFormSessions30d",
      comparator: COMPARATOR.GTE,
      tiers: tierRules,
      getProgressText: ({ value, nextTier }) => {
        const v = Math.floor(safeNum(value));
        if (!nextTier) return `Perfect form sessions: ${v}.`;
        const remaining = Math.max(0, nextTier.threshold - v);
        return `Perfect form sessions: ${v} — ${remaining} to reach ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
      },
    },
    tierDefs
  );
}

// 10) Early Bird
{
  const idPrefix = "badge_early";
  const title = "Early Bird";
  const desc = "Train before 7am";
  const family = "behaviour";
  const iconFile = "icon_earlybird.png";

  const tiers = [
    { tier: "bronze",   threshold: 3,   xp: 25 },
    { tier: "silver",   threshold: 10,  xp: 35, hidden: true },
    { tier: "gold",     threshold: 25,  xp: 45 },
    { tier: "platinum", threshold: 50,  xp: 60, hidden: true },
    { tier: "diamond",  threshold: 100, xp: 80, hidden: true },
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
      getProgressText: ({ value, nextTier }) => {
        const v = Math.floor(safeNum(value));
        if (!nextTier) return `Early sessions: ${v}.`;
        const remaining = Math.max(0, nextTier.threshold - v);
        return `Early sessions: ${v} — ${remaining} to reach ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
      },
    },
    tierDefs
  );
}

// 11) Night Grinder
{
  const idPrefix = "badge_night";
  const title = "Night Grinder";
  const desc = "Train after 9pm";
  const family = "behaviour";
  const iconFile = "icon_nightgrinder.png";

  const tiers = [
    { tier: "bronze",   threshold: 3,   xp: 25 },
    { tier: "silver",   threshold: 10,  xp: 35, hidden: true },
    { tier: "gold",     threshold: 25,  xp: 45 },
    { tier: "platinum", threshold: 50,  xp: 60, hidden: true },
    { tier: "diamond",  threshold: 100, xp: 80, hidden: true },
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
      getProgressText: ({ value, nextTier }) => {
        const v = Math.floor(safeNum(value));
        if (!nextTier) return `Night sessions: ${v}.`;
        const remaining = Math.max(0, nextTier.threshold - v);
        return `Night sessions: ${v} — ${remaining} to reach ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
      },
    },
    tierDefs
  );
}

// 12) No-Miss Weeks
{
  const idPrefix = "badge_perfect_week";
  const title = "No-Miss Weeks";
  const desc = "Perfect weeks completed";
  const family = "consistency";
  const iconFile = "icon_nomissweek.png";

  const tiers = [
    { tier: "bronze",   threshold: 1,  xp: 25 },
    { tier: "silver",   threshold: 4,  xp: 35, hidden: true },
    { tier: "gold",     threshold: 8,  xp: 45 },
    { tier: "platinum", threshold: 16, xp: 60, hidden: true },
    { tier: "diamond",  threshold: 32, xp: 80, hidden: true },
  ];

  const { tierDefs, tierRules } = makeTierDefs({ idPrefix, title, desc, family, iconFile, tiers });

  addCard(
    {
      id: "no_miss_week",
      title,
      desc,
      family,
      iconFile,
      statKey: "stats.consistency.perfectWeekCount",
      comparator: COMPARATOR.GTE,
      tiers: tierRules,
      getProgressText: ({ value, nextTier }) => {
        const v = Math.floor(safeNum(value));
        if (!nextTier) return `Perfect weeks: ${v}.`;
        const remaining = Math.max(0, nextTier.threshold - v);
        return `Perfect weeks: ${v} — ${remaining} to reach ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
      },
    },
    tierDefs
  );
}

// 13) Active Days
{
  const idPrefix = "badge_active_days";
  const title = "Active Days";
  const desc = "Days with any workout logged";
  const family = "longevity";
  const iconFile = "icon_activedays.png";

  const tiers = [
    { tier: "bronze",   threshold: 30,  xp: 25 },
    { tier: "silver",   threshold: 90,  xp: 35, hidden: true },
    { tier: "gold",     threshold: 180, xp: 45 },
    { tier: "platinum", threshold: 365, xp: 60, hidden: true },
    { tier: "diamond",  threshold: 730, xp: 80, hidden: true },
  ];

  const { tierDefs, tierRules } = makeTierDefs({ idPrefix, title, desc, family, iconFile, tiers });

  addCard(
    {
      id: "active_days",
      title,
      desc,
      family,
      iconFile,
      statKey: "stats.longevity.activeDays",
      comparator: COMPARATOR.GTE,
      tiers: tierRules,
      getProgressText: ({ value, nextTier }) => {
        const v = Math.floor(safeNum(value));
        if (!nextTier) return `Active days: ${v}.`;
        const remaining = Math.max(0, nextTier.threshold - v);
        return `Active days: ${v} — ${remaining} to reach ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
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
    { tier: "bronze",   threshold: 1,  xp: 25 },
    { tier: "silver",   threshold: 5,  xp: 35, hidden: true },
    { tier: "gold",     threshold: 15, xp: 45 },
    { tier: "platinum", threshold: 30, xp: 60, hidden: true },
    { tier: "diamond",  threshold: 60, xp: 80, hidden: true },
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

// 15) Pace Improvement (4w)
{
  const idPrefix = "badge_pace_imp";
  const title = "Pace Improvement";
  const desc = "Improve your pace vs baseline (4 weeks)";
  const family = "intelligence";
  const iconFile = "icon_paceimprove.png";

  const tiers = [
    { tier: "bronze",   threshold: 3,  xp: 25 },
    { tier: "silver",   threshold: 5,  xp: 35, hidden: true },
    { tier: "gold",     threshold: 8,  xp: 45 },
    { tier: "platinum", threshold: 12, xp: 60, hidden: true },
    { tier: "diamond",  threshold: 15, xp: 80, hidden: true },
  ];

  const { tierDefs, tierRules } = makeTierDefs({ idPrefix, title, desc, family, iconFile, tiers });

  addCard(
    {
      id: "pace_improvement",
      title,
      desc,
      family,
      iconFile,
      statKey: "stats.cardio.paceImprovementPct4w",
      comparator: COMPARATOR.GTE,
      tiers: tierRules,
      getProgressText: ({ value, nextTier }) => {
        const v = Math.round(safeNum(value) * 10) / 10;
        if (!nextTier) return `Pace improvement: ${v}%.`;
        const remaining = Math.max(0, nextTier.threshold - v);
        return `Pace improvement: ${v}% — ${remaining}% to reach ${nextTier.tier.toUpperCase()} and +${nextTier.xp} XP.`;
      },
    },
    tierDefs
  );
}

// ---------------------------------------------------------------------------
// Exports for the renderer system you already use
// ---------------------------------------------------------------------------

export const BADGE_DEFS = ALL_DEFS;
export const ALL_BADGE_KEYS = new Set(ALL_KEYS);