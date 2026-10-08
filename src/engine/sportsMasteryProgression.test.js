import { describe, expect, it } from "vitest";
import { BADGE_CARDS, BADGE_DEFS } from "../config/badges.js";
import { BADGE_XP_BY_KEY } from "./xpRewardMap.generated.js";
import { sportsMasteryState, unrealStarKey } from "./sportsMasteryProgression.js";

const cards = BADGE_CARDS.filter(card => card.badgeGroup === "sport_mastery");
const card = cards.find(card => card.sportKey === "football");
const claimedThrough = n => new Set(card.tiers.slice(0, n).map(tier => tier.key));

describe("sports mastery prestige and repeated Unreal", () => {
  it("preserves every existing tier key, threshold and XP award", () => {
    for (const sport of cards) {
      expect(sport.tiers.slice(0, 5).map(tier => [tier.key, tier.threshold, tier.xp])).toEqual(
        [1,5,15,40,80].map((threshold, i) => [`badge_sport_${sport.sportKey}_mastery_${i+1}`, threshold, [20,30,45,65,90][i]])
      );
    }
  });
  it.each([[79,"foundation"],[80,"prestige"],[239,"prestige"],[240,"unreal"],[320,"unreal"]])(
    "at %i sessions reveals the %s display", (sessions, stage) => {
      expect(sportsMasteryState(card, sessions).stage).toBe(stage);
    }
  );
  it("reveals the exact new order and thresholds for every sport", () => {
    for (const sport of cards) expect(sport.tiers.slice(5).map(t => [t.tier,t.threshold])).toEqual([
      ["pro",120],["champion",160],["elite",240],["unreal",320],
    ]);
    expect(sportsMasteryState(card,80).visibleTiers.map(t=>t.tier)).toEqual(["pro","champion","elite"]);
    expect(sportsMasteryState(card,240).visibleTiers.map(t=>t.tier)).toEqual(["unreal"]);
  });
  it("claims historical unlocked tiers one at a time before stars", () => {
    expect(sportsMasteryState(card, 500, claimedThrough(5)).nextClaimable.tier).toBe("pro");
    expect(sportsMasteryState(card, 500, claimedThrough(8)).nextClaimable.tier).toBe("unreal");
    expect(sportsMasteryState(card, 399, claimedThrough(9)).nextClaimable).toBeNull();
  });
  it("requires another 80 sessions per unique star and cannot reclaim one", () => {
    const claims = claimedThrough(9);
    const first = sportsMasteryState(card,400,claims).nextClaimable;
    expect(first).toMatchObject({key:unrealStarKey("football",1),threshold:400,xp:0,star:1});
    claims.add(first.key);
    expect(sportsMasteryState(card,400,claims).nextClaimable).toBeNull();
    expect(sportsMasteryState(card,479,claims).nextClaimable).toBeNull();
    expect(sportsMasteryState(card,480,claims).nextClaimable.star).toBe(2);
    expect(sportsMasteryState(card,440,claims).progressPct).toBe(50);
  });
  it("retains earned claims after edited logs without allowing a new star", () => {
    const claims=claimedThrough(9); claims.add(unrealStarKey("football",2));
    const state=sportsMasteryState(card,0,claims);
    expect(state.stars).toBe(2); expect(state.currentTier.tier).toBe("unreal");
    expect(state.nextClaimable).toBeNull(); expect(state.nextTier.threshold).toBe(560);
  });
  it("ignores another sport and malformed repeat keys", () => {
    const claims=claimedThrough(9);
    [unrealStarKey("rugby",9),unrealStarKey("football",0),unrealStarKey("football","01"),unrealStarKey("football","NaN")].forEach(k=>claims.add(k));
    expect(sportsMasteryState(card,400,claims).stars).toBe(0);
  });
  it("matches generated personal and group XP maps without repeat bonus XP", () => {
    for (const def of BADGE_DEFS) expect(BADGE_XP_BY_KEY[def.key]).toBe(def.xp);
    expect(BADGE_XP_BY_KEY[unrealStarKey("football",1)]).toBeUndefined();
  });
});

it("keeps the next target beyond the historical best after log edits", () => {
  const state=sportsMasteryState(card,0,new Set([card.tiers[4].key]));
  expect(state.currentTier.tier).toBe("diamond");
  expect(state.nextTier.tier).toBe("pro");
  expect(state.progressPct).toBe(0);
});
