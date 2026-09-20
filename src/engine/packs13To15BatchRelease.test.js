import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AVATAR_PACKS, AVATAR_PACK_GROUPS } from "../config/avatars.js";
import { getNextAvatarReward } from "./dashboardEngine.js";

const expectedPacks = [
  {
    number: 13,
    key: "avatar_pack_13_rescue_legends",
    title: "Avatar Pack 13 – Rescue Legends",
    unlockAtXp: 16000,
  },
  {
    number: 14,
    key: "avatar_pack_14_velvet_icons",
    title: "Avatar Pack 14 – Velvet Icons",
    unlockAtXp: 18000,
  },
  {
    number: 15,
    key: "avatar_pack_15_neon_cipher_squad",
    title: "Avatar Pack 15 – Neon Cipher Squad",
    unlockAtXp: 20000,
  },
];

describe("Packs 13–15 batch release gate", () => {
  it("extends the Legends Beyond Sport progression in exact 2,000 XP steps", () => {
    for (const expected of expectedPacks) {
      const pack = AVATAR_PACKS.find((candidate) => candidate.key === expected.key);
      expect(pack).toMatchObject({
        key: expected.key,
        title: expected.title,
        unlockAtXp: expected.unlockAtXp,
        prestigePack: true,
        eraKey: "legends_beyond_sport",
        eraTitle: "Legends Beyond Sport",
      });
      expect(pack.desc).toBe(`Unlock at ${expected.unlockAtXp.toLocaleString("en-GB")} XP`);
    }

    expect(getNextAvatarReward(14000, AVATAR_PACKS)).toMatchObject({
      key: "avatar_pack_13_rescue_legends",
      unlockAtXp: 16000,
      remainingXp: 2000,
    });
    expect(getNextAvatarReward(16000, AVATAR_PACKS)).toMatchObject({
      key: "avatar_pack_14_velvet_icons",
      unlockAtXp: 18000,
      remainingXp: 2000,
    });
    expect(getNextAvatarReward(18000, AVATAR_PACKS)).toMatchObject({
      key: "avatar_pack_15_neon_cipher_squad",
      unlockAtXp: 20000,
      remainingXp: 2000,
    });
  });

  it("contains exactly eight unique, complete production avatars per pack", () => {
    for (const expected of expectedPacks) {
      const pack = AVATAR_PACKS.find((candidate) => candidate.key === expected.key);
      expect(pack.avatars).toHaveLength(8);
      expect(new Set(pack.avatars.map((avatar) => avatar.id)).size).toBe(8);
      expect(new Set(pack.avatars.map((avatar) => avatar.imgSrc)).size).toBe(8);

      for (const avatar of pack.avatars) {
        expect(avatar.prestige).toBe(true);
        expect(avatar.id).toMatch(new RegExp(`^p${expected.number}_`));
        expect(avatar.label).toBeTruthy();
        expect(avatar.subtitle).toBeTruthy();
        expect(avatar.imgSrc).toMatch(
          new RegExp(`^/avatars/pack${expected.number}/[a-z0-9-]+\\.png$`)
        );
      }
    }
  });

  it("has every configured binary asset present and below the release ceiling", () => {
    for (const expected of expectedPacks) {
      const pack = AVATAR_PACKS.find((candidate) => candidate.key === expected.key);
      for (const avatar of pack.avatars) {
        const absolute = path.resolve(
          process.cwd(),
          "public",
          avatar.imgSrc.replace(/^\/avatars\//, "avatars/")
        );
        expect(fs.existsSync(absolute), `Missing production avatar asset: ${avatar.imgSrc}`).toBe(true);
        expect(fs.statSync(absolute).size, `Oversized production avatar asset: ${avatar.imgSrc}`).toBeLessThanOrEqual(750000);
      }
    }
  });

  it("surfaces all three packs under Legends Beyond Sport in threshold order", () => {
    const era = AVATAR_PACK_GROUPS.find(
      (group) => group.key === "legends_beyond_sport"
    );
    expect(era).toBeTruthy();
    expect(
      era.packs
        .filter((pack) => expectedPacks.some((expected) => expected.key === pack.key))
        .map((pack) => pack.key)
    ).toEqual(expectedPacks.map((pack) => pack.key));
  });
});
