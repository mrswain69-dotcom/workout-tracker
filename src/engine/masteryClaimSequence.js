// The cabinet claims an earned best badge and any earlier unclaimed tiers through
// the existing queued, eligibility-checked reward path. Retry skips saved claims.
export async function claimMasterySequence({ rewards, claimOne, isClaimed, isCurrentProfile }) {
  const claimed = [];
  for (const reward of rewards) {
    if (!isCurrentProfile()) return { complete: false, claimed };
    if (isClaimed(reward.key)) continue;
    const saved = await claimOne(reward.key);
    if (!isCurrentProfile()) return { complete: false, claimed };
    if (saved) claimed.push(reward);
    else if (!isClaimed(reward.key)) return { complete: false, claimed };
  }
  return { complete: true, claimed };
}
