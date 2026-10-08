import React from "react";

function TierChips({ tiers, claimedKeys, value }) {
  return <div className="badgeTierGrid">
    {tiers.map(tier => {
      const claimed = claimedKeys.has(tier.key);
      const earned = value >= tier.threshold;
      return <div key={tier.key} className={`badgeTierChip badgeTierChip--${claimed ? "claimed" : earned ? "earned" : "locked"}`}>
        <div className="badgeTierChipName">{tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1)}</div>
        <div className="badgeTierChipMeta">{tier.threshold} counted sessions · +{tier.xp} XP</div>
        <div className="mini">{claimed ? "Claimed" : earned ? "Ready to claim" : "Locked"}</div>
      </div>;
    })}
  </div>;
}

export default function SportsMasteryMilestones({ state, claimedKeys }) {
  const achievementIndex = Math.max(state.highestEarnedIndex, state.highestClaimedIndex);
  return <div className="sportMasteryMilestones">
    {state.stage !== "foundation" && <div className="sportMasteryAchievements">
      <span className="pill">◆ Diamond achieved</span>
      {achievementIndex >= 7 && <span className="pill">Elite achieved</span>}
    </div>}
    <TierChips tiers={state.visibleTiers} claimedKeys={claimedKeys} value={state.value} />
    {state.stage === "unreal" && <p className="mini muted">After Unreal, every further 80 counted sessions unlocks a star. Stars do not add bonus XP.</p>}
    <details className="sportMasteryHistory">
      <summary>Achievement history and counting rules</summary>
      <p className="mini muted">A session counts when you record sport activity, including partial structured sessions. Cancelled sessions and future dates do not count. Each sport counts at most once per day. Existing claimed achievements stay in your history if you later edit a log.</p>
      <TierChips tiers={state.tiers} claimedKeys={claimedKeys} value={state.value} />
      {state.stars > 0 && <p>{state.stars} Unreal {state.stars === 1 ? "star claimed" : "stars claimed"}</p>}
    </details>
  </div>;
}
