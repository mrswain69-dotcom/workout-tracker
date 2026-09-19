import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AVATAR_ERAS,
  AVATAR_PACKS,
  AVATAR_PACK_GROUPS,
  getAvatarEraForPack,
  groupAvatarPacksByEra,
} from "../config/avatars.js";

const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

describe("post-10k avatar rewards scaffolding", () => {
  it("locks the five reward eras without activating unfinished post-10k packs", () => {
    expect(AVATAR_ERAS.map((era) => era.key)).toEqual([
      "athlete_journey",
      "legends_beyond_sport",
      "elite_machines_operators",
      "mythic_prestige",
      "infinite_mastery",
    ]);
    expect(Math.max(...AVATAR_PACKS.map((pack) => pack.unlockAtXp))).toBe(10000);
    expect(AVATAR_PACK_GROUPS).toHaveLength(1);
    expect(AVATAR_PACK_GROUPS[0].key).toBe("athlete_journey");
  });

  it("will group future packs into the locked era structure deterministically", () => {
    const future = [
      { key: "p11", unlockAtXp: 12000, eraKey: "legends_beyond_sport" },
      { key: "p21", unlockAtXp: 35000, eraKey: "elite_machines_operators" },
      { key: "p26", unlockAtXp: 60000, eraKey: "mythic_prestige" },
      { key: "p27", unlockAtXp: 70000, eraKey: "infinite_mastery" },
    ];
    const grouped = groupAvatarPacksByEra(future);
    expect(grouped.map((era) => [era.key, era.packs.length])).toEqual([
      ["legends_beyond_sport", 1],
      ["elite_machines_operators", 1],
      ["mythic_prestige", 1],
      ["infinite_mastery", 1],
    ]);
    expect(getAvatarEraForPack({ unlockAtXp: 12000 })?.key).toBe("legends_beyond_sport");
  });

  it("keeps the Rewards catalogue scalable and image loading lazy", () => {
    expect(app).toContain("AVATAR_PACK_GROUPS.map");
    expect(app).toContain('className="avatarEraSection"');
    expect(app).toContain('className="avatarEraDetails"');
    expect(app).toContain('loading="lazy"');
    expect(app).toContain('decoding="async"');
    expect(app).not.toContain("AVATAR_PACKS.map((pack)");
  });
});
