import React from "react";
const label = tier => tier.charAt(0).toUpperCase() + tier.slice(1);

export function MasteryBadgeArt({ card, tier, muted = false, tiny = false, faceText, verified = false }) {
  return <span className={`masteryBadgeArt${muted ? " masteryBadgeArt--muted" : ""}${tiny ? " masteryBadgeArt--tiny" : ""}`} aria-hidden="true">
    <img className="masteryBadgeShell" src={`/badges/bg/bg_${card.family}_${tier.tier}.svg`} alt="" />
    {!tiny && <span className="masteryBadgeSport">{faceText ?? (card.badgeGroup === "sport_mastery" ? card.title.replace(/\s+Mastery$/i, "") : "")}</span>}
    <img className="masteryBadgeIcon" src={`/badges/icons/${card.iconFile}`} alt="" />
    {verified && <span className="masteryVerifiedStar" title="Verified performance" aria-hidden="true">★</span>}
    {!tiny && <span className="masteryBadgeTier">{label(tier.tier)}</span>}
  </span>;
}
