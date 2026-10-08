// Existing five reward IDs and thresholds are stable. Prestige appends to them.
export const SPORT_MASTERY_TIERS = [
  { tier: "bronze", threshold: 1, xp: 20 },
  { tier: "silver", threshold: 5, xp: 30 },
  { tier: "gold", threshold: 15, xp: 45 },
  { tier: "platinum", threshold: 40, xp: 65 },
  { tier: "diamond", threshold: 80, xp: 90 },
  { tier: "pro", threshold: 120, xp: 110 },
  { tier: "champion", threshold: 160, xp: 130 },
  { tier: "elite", threshold: 240, xp: 160 },
  { tier: "unreal", threshold: 320, xp: 200 },
];
export const UNREAL_STAR_INTERVAL = 80;

export function unrealStarKey(sportKey, star) {
  return `badge_sport_${sportKey}_mastery_unreal_star_${star}`;
}

export function sportsMasteryState(card, sessionCount, claimedKeys = new Set()) {
  const value = Number.isFinite(Number(sessionCount)) ? Math.max(0, Math.floor(Number(sessionCount))) : 0;
  const tiers = card.tiers;
  const highestEarnedIndex = tiers.reduce((max, tier, index) => value >= tier.threshold ? index : max, -1);
  const highestClaimedIndex = tiers.reduce((max, tier, index) => claimedKeys.has(tier.key) ? index : max, -1);
  const prefix = unrealStarKey(card.sportKey, "");
  let stars = 0;
  for (const key of claimedKeys) {
    if (typeof key !== "string" || !key.startsWith(prefix)) continue;
    const suffix = key.slice(prefix.length);
    if (!/^[1-9]\d*$/.test(suffix)) continue;
    const star = Number(suffix);
    if (Number.isSafeInteger(star)) stars = Math.max(stars, star);
  }
  const nextStar = {
    key: unrealStarKey(card.sportKey, stars + 1),
    tier: "unreal", threshold: 320 + (stars + 1) * UNREAL_STAR_INTERVAL,
    xp: 0, star: stars + 1,
  };
  // Never re-claim a tier after deleting/editing its source logs. Each star has a
  // unique stable key and its own cumulative threshold, including historical catch-up.
  const nextClaimable = tiers.find(tier => value >= tier.threshold && !claimedKeys.has(tier.key)) ||
    (claimedKeys.has(tiers[8].key) && value >= nextStar.threshold ? nextStar : null);
  const displayIndex = Math.max(highestEarnedIndex, highestClaimedIndex, stars ? 8 : -1);
  const stage = displayIndex >= 7 ? "unreal" : displayIndex >= 4 ? "prestige" : "foundation";
  const visibleTiers = stage === "unreal" ? tiers.slice(8) : stage === "prestige" ? tiers.slice(5, 8) : tiers.slice(0, 5);
  const nextTier = tiers[displayIndex + 1] || nextStar;
  const currentTier = tiers[displayIndex] || null;
  const floor = nextTier.star ? nextTier.threshold - UNREAL_STAR_INTERVAL :
    tiers[Math.max(0, tiers.indexOf(nextTier) - 1)]?.threshold || 0;
  const progressPct = Math.max(0, Math.min(100, Math.round((value - (nextTier === tiers[0] ? 0 : floor)) /
    Math.max(1, nextTier.threshold - (nextTier === tiers[0] ? 0 : floor)) * 100)));
  return {
    value, tiers, highestEarnedIndex, highestClaimedIndex, currentTier, nextTier, nextClaimable,
    status: nextClaimable ? "claimable" : displayIndex >= 0 ? "claimed" : "locked",
    stage, visibleTiers, stars, progressPct,
  };
}
