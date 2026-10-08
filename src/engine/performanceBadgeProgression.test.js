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
it("completes the collection at Diamond without inventing a sixth target", () => {
  const state = performanceBadgeState(count, count.tiers[4].threshold);
  expect(state.currentTier.tier).toBe("diamond"); expect(state.nextTier).toBeNull();
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
