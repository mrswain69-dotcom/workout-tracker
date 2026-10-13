import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { AVATAR_PACKS, AVATAR_PACK_GROUPS } from "../config/avatars.js";
import { AVATAR_STORY_PROFILES } from "../config/avatarStories.js";
import { getNextAvatarReward } from "./dashboardEngine.js";

describe("Packs 16–20 release", () => {
  const packs = AVATAR_PACKS.filter(p => p.unlockAtXp >= 22000);
  it("unlocks five complete packs in exact XP order", () => {
    expect(packs.map(p => p.unlockAtXp)).toEqual([22000, 24000, 26000, 28000, 30000]);
    expect(AVATAR_PACK_GROUPS.find(g => g.key === "elite_machines_operators").packs).toEqual(packs);
    for (const p of packs) {
      expect(p.avatars).toHaveLength(8);
      expect(getNextAvatarReward(p.unlockAtXp - 1, AVATAR_PACKS)).toMatchObject({key:p.key, remainingXp:1});
    }
    expect(getNextAvatarReward(30000, AVATAR_PACKS)).toBeNull();
  });
  it("preserves unique identities and individual stories", () => {
    const avatars = AVATAR_PACKS.flatMap(p => p.avatars);
    expect(new Set(avatars.map(a => a.id)).size).toBe(avatars.length);
    for (const a of packs.flatMap(p => p.avatars)) {
      expect(a.subtitle).toBeTruthy();
      const words = AVATAR_STORY_PROFILES[a.id].story.trim().split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(30);
      expect(words).toBeLessThanOrEqual(70);
    }
  });
  it("ships complete 1024px RGBA PNGs below the size ceiling", () => {
    for (const a of packs.flatMap(p => p.avatars)) {
      const bytes = fs.readFileSync(`public${a.imgSrc}`);
      expect(bytes.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(bytes.readUInt32BE(16)).toBe(1024);
      expect(bytes.readUInt32BE(20)).toBe(1024);
      expect(bytes[25]).toBe(6);
      expect(bytes.length).toBeLessThanOrEqual(750000);
    }
  });
});
