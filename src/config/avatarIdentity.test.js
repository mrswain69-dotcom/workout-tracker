import { describe, expect, it } from "vitest";
import { listAvatarIdentities, resolveAvatarIdentity } from "./avatarIdentity";

describe("avatar identity metadata", () => {
  it("gives every XP avatar complete identity metadata and a 30–70 word story", () => {
    const identities = listAvatarIdentities();
    expect(identities.length).toBeGreaterThan(100);
    for (const identity of identities) {
      const words = identity.story.trim().split(/\s+/).length;
      expect(identity.collection).toBeTruthy();
      expect(identity.unlockSource?.type).toBe("xp_pack");
      expect(identity.unlockSource?.requirement?.xp).toBeGreaterThan(0);
      expect(identity.traits).toHaveLength(3);
      expect(words).toBeGreaterThanOrEqual(30);
      expect(words).toBeLessThanOrEqual(70);
    }
  });

  it("resolves non-XP sport mastery requirements", () => {
    const identity = resolveAvatarIdentity("sport_avatar_football_gold");
    expect(identity.label).toBe("Football Gold");
    expect(identity.unlockSource).toEqual({
      type: "sport_mastery",
      label: "120 counted Football sessions",
      requirement: { sportKey: "football", sessions: 120, tier: "gold" },
    });
  });
});
