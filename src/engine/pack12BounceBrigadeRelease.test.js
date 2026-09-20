import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AVATAR_PACKS, AVATAR_PACK_GROUPS } from "../config/avatars.js";
import { getNextAvatarReward } from "./dashboardEngine.js";

const pack12 = AVATAR_PACKS.find(
  (pack) => pack.key === "avatar_pack_12_bounce_brigade"
);

describe("Pack 12 — Bounce Brigade release gate", () => {
  it("unlocks at exactly 14,000 XP after Pack 11", () => {
    expect(pack12).toBeTruthy();
    expect(pack12.unlockAtXp).toBe(14000);
    expect(pack12.prestigePack).toBe(true);
    expect(pack12.eraKey).toBe("legends_beyond_sport");
    expect(getNextAvatarReward(12000, AVATAR_PACKS)).toMatchObject({
      key: "avatar_pack_12_bounce_brigade",
      unlockAtXp: 14000,
      remainingXp: 2000,
    });
  });

  it("contains exactly eight unique production avatars", () => {
    expect(pack12.avatars).toHaveLength(8);
    expect(new Set(pack12.avatars.map((avatar) => avatar.id)).size).toBe(8);
    expect(new Set(pack12.avatars.map((avatar) => avatar.imgSrc)).size).toBe(8);
    for (const avatar of pack12.avatars) {
      expect(avatar.prestige).toBe(true);
      expect(avatar.id).toMatch(/^p12_/);
      expect(avatar.imgSrc).toMatch(/^\/avatars\/pack12\/[a-z0-9-]+\.png$/);
      expect(avatar.subtitle).toBeTruthy();
    }
  });

  it("has every configured binary asset present before release", () => {
    for (const avatar of pack12.avatars) {
      const absolute = path.resolve(
        process.cwd(),
        "public",
        avatar.imgSrc.replace(/^\/avatars\//, "avatars/")
      );
      expect(
        fs.existsSync(absolute),
        `Missing production avatar asset: ${avatar.imgSrc}`
      ).toBe(true);
    }
  });

  it("surfaces Pack 12 under Legends Beyond Sport", () => {
    const era = AVATAR_PACK_GROUPS.find(
      (group) => group.key === "legends_beyond_sport"
    );
    expect(era).toBeTruthy();
    expect(era.packs.map((pack) => pack.key)).toContain(
      "avatar_pack_12_bounce_brigade"
    );
  });
});
