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
