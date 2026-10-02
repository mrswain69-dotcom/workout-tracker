import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRESTIGE_FRAME,
  PRESTIGE_FRAME_OPTIONS,
  PRESTIGE_FRAME_UNLOCK_XP,
  getPrestigeFrameState,
  normalisePrestigeFrameKey,
} from "./avatarFrameSettings.js";

describe("prestige avatar frame settings", () => {
  it("keeps frame controls locked below 10,000 XP", () => {
    expect(getPrestigeFrameState(8_500)).toEqual({
      earned: false,
      xp: 8_500,
      remainingXp: 1_500,
      progressPct: 85,
    });
  });

  it("unlocks frame controls at the exact threshold", () => {
    const state = getPrestigeFrameState(PRESTIGE_FRAME_UNLOCK_XP);
    expect(state.earned).toBe(true);
    expect(state.remainingXp).toBe(0);
    expect(state.progressPct).toBe(100);
  });

  it("keeps the supported frame palette authoritative", () => {
    expect(PRESTIGE_FRAME_OPTIONS).toHaveLength(5);
    expect(new Set(PRESTIGE_FRAME_OPTIONS.map((frame) => frame.key)).size).toBe(5);
    expect(normalisePrestigeFrameKey("prestige_red_black")).toBe("prestige_red_black");
    expect(normalisePrestigeFrameKey("unknown-frame")).toBe(DEFAULT_PRESTIGE_FRAME);
  });
});
