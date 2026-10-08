// Performance metrics retain their own thresholds, including lower-is-better times.
export function performanceBadgeState(card, rawValue, claimedKeys = new Set()) {
  const tiers = card.tiers || [];
  const value = rawValue == null || !Number.isFinite(Number(rawValue)) ? null : Number(rawValue);
  const eligible = tier => value != null && (card.comparator === "lte" ? value > 0 && value <= tier.threshold : value >= tier.threshold);
  let highestEarnedIndex = -1;
  let highestClaimedIndex = -1;
  tiers.forEach((tier, index) => {
    if (eligible(tier)) highestEarnedIndex = index;
    if (claimedKeys.has(tier.key)) highestClaimedIndex = index;
  });
  const displayIndex = Math.max(highestEarnedIndex, highestClaimedIndex);
  const currentTier = tiers[displayIndex] || null;
  const nextTier = tiers[displayIndex + 1] || null;
  const nextClaimable = tiers.find(tier => eligible(tier) && !claimedKeys.has(tier.key)) || null;
  return {
    value, tiers, highestEarnedIndex, highestClaimedIndex, currentTier, nextTier, nextClaimable,
    status: nextClaimable ? "claimable" : currentTier ? "claimed" : "locked",
    // Pace progress is shown as the actual time and target, without an invented baseline.
    progressPct: card.comparator === "lte" ? null : !nextTier ? 100 : Math.max(0, Math.min(100,
      Math.round(((value || 0) - (currentTier?.threshold || 0)) / (nextTier.threshold - (currentTier?.threshold || 0)) * 100))),
  };
}
