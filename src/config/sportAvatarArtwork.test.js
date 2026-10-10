import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SPORT_MASTERY_PACKS } from "./badges";
import { SPORT_AVATAR_ARTWORK_READY, PAIRED_SPORT_AVATAR_ARTWORK_READY, hasSportAvatarArtwork, sportAvatarArtworkSrc } from "./sportAvatarArtwork";
import { resolveAvatarIdentity } from "./avatarIdentity";

const tiers = ["bronze", "silver", "gold", "platinum", "diamond", "elite", "champion", "unreal"];

describe("sport avatar artwork releases", () => {
  it("ships an actual transparent PNG for every published sport and tier", () => {
    for (const sport of SPORT_AVATAR_ARTWORK_READY) {
      expect(SPORT_MASTERY_PACKS[sport]).toBeTruthy();
      for (const tier of tiers) {
        const path = sportAvatarArtworkSrc(sport, tier);
        const png = readFileSync(new URL(`../../public${path}`, import.meta.url));
        expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
        expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(500);
        expect(png.readUInt32BE(20)).toBeGreaterThanOrEqual(500);
        expect(png[25]).toBe(6); // RGBA: preserve the generated transparent background.
      }
    }
  });

  it("keeps unfinished collections from requesting missing assets while retaining identity requirements", () => {
    for (const sport of Object.keys(SPORT_MASTERY_PACKS).filter(key => !hasSportAvatarArtwork(key))) {
      for (const tier of tiers) {
        expect(sportAvatarArtworkSrc(sport, tier)).toBeNull();
        const identity = resolveAvatarIdentity(`sport_avatar_${sport}_${tier}`);
        expect(identity.imgSrc).toBeNull();
        expect(identity.unlockSource.requirement.sportKey).toBe(sport);
      }
    }
    expect(hasSportAvatarArtwork("unknown")).toBe(false);
  });

  it("preserves all eight rugby unlock thresholds with distinct character stories", () => {
    const identities = tiers.map(tier => resolveAvatarIdentity(`sport_avatar_rugby_${tier}`));
    expect(identities.map(item => item.unlockSource.requirement.sessions)).toEqual([40, 80, 120, 160, 200, 240, 280, 320]);
    expect(new Set(identities.map(item => item.story)).size).toBe(8);
    for (const identity of identities) {
      expect(identity.imgSrc).toContain("/avatars/sport/rugby_");
      expect(identity.traits).toHaveLength(3);
      const words = identity.story.trim().split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(30);
      expect(words).toBeLessThanOrEqual(70);
    }
  });
});

describe("paired appearances", () => {
  it("ships both complete collections without splitting rewards or thresholds", () => {
    for (const sport of PAIRED_SPORT_AVATAR_ARTWORK_READY) for (const tier of tiers) {
      const original = resolveAvatarIdentity(`sport_avatar_${sport}_${tier}`);
      for (const variant of ["male", "female"]) {
        const paired = resolveAvatarIdentity(original.id, { edition: "paired_v2", variant });
        expect(paired.id).toBe(original.id);
        expect(paired.unlockSource).toEqual(original.unlockSource);
        const revision = ["football", "rugby"].includes(sport) && !["bronze", "silver"].includes(tier) ? "v3" : "v2";
        expect(paired.imgSrc).toBe(`/avatars/sport/${sport}_${tier}_${variant}_${revision}.png`);
        const png = readFileSync(new URL(`../../public${paired.imgSrc}`, import.meta.url));
        expect(png.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
        expect(png[25]).toBe(6);
        expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(1000);
      }
    }
  });
  it("uses a valid default for paired-only collections", () => {
    for (const sport of PAIRED_SPORT_AVATAR_ARTWORK_READY.filter(key => !SPORT_AVATAR_ARTWORK_READY.includes(key))) {
      for (const tier of tiers) {
        expect(sportAvatarArtworkSrc(sport, tier)).toBe(`/avatars/sport/${sport}_${tier}_male_v2.png`);
        expect(sportAvatarArtworkSrc(sport, tier, {edition:"paired_v2",variant:"female"})).toBe(`/avatars/sport/${sport}_${tier}_female_v2.png`);
      }
    }
  });
  it("retains originals and rejects incomplete or invalid variant paths", () => {
    for (const appearance of [undefined, {variant:"female"}, {edition:"paired_v2",variant:"../x"}]) {
      expect(sportAvatarArtworkSrc("football","bronze",appearance)).toBe("/avatars/sport/football_bronze.png");
    }
    expect(sportAvatarArtworkSrc("indoor_rowing","bronze",{edition:"paired_v2",variant:"female"})).toBeNull();
    expect(sportAvatarArtworkSrc("football","../x")).toBeNull();
  });
});
