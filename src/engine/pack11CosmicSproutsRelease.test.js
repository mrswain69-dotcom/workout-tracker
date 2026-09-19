import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AVATAR_PACKS, AVATAR_PACK_GROUPS } from "../config/avatars.js";
import { getNextAvatarReward } from "./dashboardEngine.js";

const pack11 = AVATAR_PACKS.find(
  (pack) => pack.key === "avatar_pack_11_cosmic_sprouts"
);

describe("Pack 11 — Cosmic Sprouts release gate", () => {
  it("is the first post-10k pack at exactly 12,000 XP", () => {
    expect(pack11).toBeTruthy();
    expect(pack11.unlockAtXp).toBe(12000);
    expect(pack11.prestigePack).toBe(true);
    expect(pack11.eraKey).toBe("legends_beyond_sport");
    expect(getNextAvatarReward(10000, AVATAR_PACKS)).toMatchObject({
      key: "avatar_pack_11_cosmic_sprouts",
      unlockAtXp: 12000,
      remainingXp: 2000,
    });
  });

  it("contains exactly eight unique production avatars", () => {
    expect(pack11.avatars).toHaveLength(8);
    expect(new Set(pack11.avatars.map((avatar) => avatar.id)).size).toBe(8);
    expect(new Set(pack11.avatars.map((avatar) => avatar.imgSrc)).size).toBe(8);
    for (const avatar of pack11.avatars) {
      expect(avatar.prestige).toBe(true);
      expect(avatar.id).toMatch(/^p11_/);
      expect(avatar.imgSrc).toMatch(/^\/avatars\/pack11\/[a-z0-9-]+\.png$/);
      expect(avatar.subtitle).toBeTruthy();
    }
  });

  it("has every configured binary asset present before release", () => {
    for (const avatar of pack11.avatars) {
      const absolute = path.resolve(
        process.cwd(),
        "public",
        avatar.imgSrc.replace(/^\/avatars\//, "avatars/")
      );
      expect(fs.existsSync(absolute), `Missing production avatar asset: ${avatar.imgSrc}`).toBe(true);
    }
  });

  it("surfaces Pack 11 under Legends Beyond Sport", () => {
    const era = AVATAR_PACK_GROUPS.find(
      (group) => group.key === "legends_beyond_sport"
    );
    expect(era).toBeTruthy();
    expect(era.packs.map((pack) => pack.key)).toContain(
      "avatar_pack_11_cosmic_sprouts"
    );
  });
});
