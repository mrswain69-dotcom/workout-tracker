import React from "react";
const label = tier => tier.charAt(0).toUpperCase() + tier.slice(1);

export function MasteryBadgeArt({ card, tier, muted = false, tiny = false }) {
  return <span className={`masteryBadgeArt${muted ? " masteryBadgeArt--muted" : ""}${tiny ? " masteryBadgeArt--tiny" : ""}`} aria-hidden="true">
    <img className="masteryBadgeShell" src={`/badges/bg/bg_${card.family}_${tier.tier}.svg`} alt="" />
    {!tiny && <span className="masteryBadgeSport">{card.title.replace(/\s+Mastery$/i, "")}</span>}
    <img className="masteryBadgeIcon" src={`/badges/icons/${card.iconFile}`} alt="" />
    {!tiny && <span className="masteryBadgeTier">{label(tier.tier)}</span>}
  </span>;
}
