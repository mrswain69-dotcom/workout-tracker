import { expect, it } from "vitest";
import { BADGE_CARDS } from "../config/badges.js";
import { performanceBadgeState } from "./performanceBadgeProgression.js";
const pace = BADGE_CARDS.find(card => card.comparator === "lte");
const count = BADGE_CARDS.find(card => card.statKey === "stats.lifts.totalSets");
it("earns pace tiers with lower times and excludes empty or invalid results", () => {
  for (const value of [null, undefined, NaN, 0, -1]) expect(performanceBadgeState(pace, value).currentTier).toBeNull();
  const state = performanceBadgeState(pace, pace.tiers[2].threshold);
  expect(state.currentTier).toEqual(pace.tiers[2]);
  expect(state.nextTier).toEqual(pace.tiers[3]);
  expect(state.nextClaimable).toEqual(pace.tiers[0]);
  expect(state.progressPct).toBeNull();
});
it("opens prestige after Diamond while keeping existing reward keys", () => {
  const state = performanceBadgeState(count, count.tiers[4].threshold);
  expect(state.currentTier.tier).toBe("diamond"); expect(state.nextTier.tier).toBe("pro");
  expect(state.nextClaimable).toEqual(count.tiers[0]);
});
it("retains claimed trophies after log edits and does not award them twice", () => {
  const claims = new Set(count.tiers.slice(0,3).map(tier => tier.key));
  const state = performanceBadgeState(count, 0, claims);
  expect(state.currentTier.tier).toBe("gold"); expect(state.nextTier.tier).toBe("platinum");
  expect(state.nextClaimable).toBeNull();
});
it("finds gaps in claimed history without skipping or reclaiming saved tiers", () => {
  const claims = new Set([count.tiers[2].key]);
  expect(performanceBadgeState(count, count.tiers[2].threshold, claims).nextClaimable).toEqual(count.tiers[0]);
});
it("makes all fifteen pace progressions strictly faster through ten distinct stars",()=>{
  for(const card of BADGE_CARDS.filter(c=>c.comparator==="lte")) {
    expect(card.tiers).toHaveLength(9); expect(card.starTiers).toHaveLength(10);
    const all=[...card.tiers,...card.starTiers];
    all.slice(1).forEach((tier,i)=>expect(tier.threshold).toBeLessThan(all[i].threshold));
    expect(card.starTiers[9].threshold).toBe(card.prestige.ceiling);
  }
});
it("requires claiming Unreal before stars, caps at ten and never gives star XP",()=>{
  const value=count.starTiers[9].threshold;
  expect(performanceBadgeState(count,value).nextClaimable.star).toBeUndefined();
  const claims=new Set(count.tiers.map(t=>t.key));
  expect(performanceBadgeState(count,value,claims).nextClaimable.star).toBe(1);
  count.starTiers.forEach(t=>{expect(t.xp).toBe(0);claims.add(t.key);});
  const complete=performanceBadgeState(count,value,claims);
  expect(complete.stars).toBe(10);expect(complete.nextTier).toBeNull();expect(complete.nextClaimable).toBeNull();
});
it("switches Session Builder to repeated training days after Diamond",()=>{
  const card=BADGE_CARDS.find(c=>c.id==="session_max_sets");
  const stats={sessions:{strengthTrainingDays:200}};
  expect(performanceBadgeState(card,40,new Set(),stats).currentTier.tier).toBe("platinum");
  expect(performanceBadgeState(card,50,new Set(),stats).currentTier.tier).toBe("unreal");
  const earned=performanceBadgeState(card,50,new Set(),{sessions:{strengthTrainingDays:20}});
  expect(earned.currentTier.tier).toBe("pro"); expect(earned.nextTier.unit).toMatch(/strength days/);
});
it("keeps pace improvement bounded and uses qualifying dates for prestige",()=>{
  const card=BADGE_CARDS.find(c=>c.id==="pace_improvement");
  const state=performanceBadgeState(card,15,new Set(),{intelligence:{paceImprovementDays:40}});
  expect(state.currentTier.tier).toBe("unreal");expect(state.eligibleRewards).toHaveLength(9);
});
