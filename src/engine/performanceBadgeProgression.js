export function performanceStat(stats, path) {
  return String(path || "").replace(/^stats\./, "").split(".").reduce((value,key)=>value?.[key],stats);
}
export function isPerformanceTierEarned(card, tier, rawValue, claimedKeys=new Set(), stats={}) {
  const raw=tier.statKey?performanceStat(stats,tier.statKey):rawValue;
  if (raw == null || !Number.isFinite(Number(raw))) return false;
  const value=Number(raw);
  if (tier.statKey && !(Number(rawValue)>=card.tiers[4].threshold || card.tiers.slice(4).some(t=>claimedKeys.has(t.key)))) return false;
  return card.comparator === "lte" ? value>0 && value<=tier.threshold : value>=tier.threshold;
}
export function performanceBadgeState(card, rawValue, claimedKeys = new Set(), stats = {}) {
  const tiers=card.tiers || [];
  const value=rawValue==null||!Number.isFinite(Number(rawValue))?null:Number(rawValue);
  const eligible=tier=>isPerformanceTierEarned(card,tier,value,claimedKeys,stats);
  const earnedKeys=new Set(tiers.filter(eligible).map(t=>t.key));
  let highestEarnedIndex=-1, highestClaimedIndex=-1;
  tiers.forEach((tier,index)=>{if(earnedKeys.has(tier.key)) highestEarnedIndex=index;if(claimedKeys.has(tier.key))highestClaimedIndex=index;});
  const stars=(card.starTiers||[]).reduce((max,tier)=>claimedKeys.has(tier.key)?Math.max(max,tier.star):max,0);
  const displayIndex=Math.max(highestEarnedIndex,highestClaimedIndex,stars?8:-1);
  const currentTier=tiers[displayIndex]||null;
  const nextStar=(card.starTiers||[]).find(tier=>tier.star>stars)||null;
  const nextTier=tiers[displayIndex+1]||nextStar;
  const nextClaimable=tiers.find(tier=>earnedKeys.has(tier.key)&&!claimedKeys.has(tier.key))||
    (claimedKeys.has(tiers[8]?.key)&&nextStar&&eligible(nextStar)?nextStar:null);
  const targetValue=nextTier?.statKey?Number(performanceStat(stats,nextTier.statKey)||0):value;
  const floor=nextTier?.star?(card.starTiers[nextTier.star-2]?.threshold||tiers[8].threshold):
    nextTier?.statKey&&!currentTier?.statKey?0:(currentTier?.threshold||0);
  return {value,tiers,highestEarnedIndex,highestClaimedIndex,currentTier,nextTier,nextClaimable,stars,earnedKeys,
    eligibleRewards:tiers.filter(tier=>earnedKeys.has(tier.key)&&!claimedKeys.has(tier.key)),
    stage:displayIndex>=7?"unreal":displayIndex>=4?"prestige":"foundation",
    targetValue, earnedStarKeys:new Set((card.starTiers||[]).filter(eligible).map(tier=>tier.key)),
    status:nextClaimable?"claimable":currentTier?"claimed":"locked",
    progressPct:card.comparator==="lte"?null:!nextTier?100:Math.max(0,Math.min(100,Math.round(((targetValue||0)-floor)/(nextTier.threshold-floor)*100))),
  };
}
