import { describe, expect, it } from "vitest";
import { groupAvatarFrameClass, resolveGroupAvatar } from "./groupIdentity";

describe("Group Stage 2 competitive identity", () => {
  it("resolves existing XP avatars", () => {
    expect(resolveGroupAvatar("emoji_bolt")).toEqual(expect.objectContaining({ id: "emoji_bolt", emoji: "⚡" }));
  });

  it("derives Sport Mastery image paths without exposing profile data", () => {
    expect(resolveGroupAvatar("sport_avatar_football_gold").imgSrc).toBe("/avatars/sport/football_gold.png");
  });

  it("falls back safely for unknown or empty avatar ids", () => {
    expect(resolveGroupAvatar("").emoji).toBe("🙂");
    expect(resolveGroupAvatar("unknown-id").imgSrc).toBe("");
  });

  it("uses only deliberately selected cosmetic frame state", () => {
    expect(groupAvatarFrameClass({ avatarFrame: "prestige_red", avatarFramesEnabled: true })).toBe("avatarFrame-prestige_red");
    expect(groupAvatarFrameClass({ avatarFrame: "prestige_red", avatarFramesEnabled: false })).toBe("");
  });
});

it("uses a validated paired appearance in group displays with the same identity", () => {
  expect(resolveGroupAvatar("sport_avatar_football_gold", {edition:"paired_v2",variant:"female"}).imgSrc).toBe("/avatars/sport/football_gold_female_v3.png");
  expect(resolveGroupAvatar("sport_avatar_football_gold").imgSrc).toBe("/avatars/sport/football_gold.png");
});

it("shares Rugby's selected appearance and retains its legacy default", () => {
  for (const variant of ["male", "female"]) {
    expect(resolveGroupAvatar("sport_avatar_rugby_unreal", {edition:"paired_v2",variant}).imgSrc)
      .toBe(`/avatars/sport/rugby_unreal_${variant}_v3.png`);
  }
  expect(resolveGroupAvatar("sport_avatar_rugby_unreal").imgSrc).toBe("/avatars/sport/rugby_unreal.png");
});
