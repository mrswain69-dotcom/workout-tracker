import { SPORT_MASTERY_PACKS } from "./badges";
import { AVATAR_PACKS } from "./avatars";
import { AVATAR_STORY_PROFILES } from "./avatarStories";

export const AVATAR_IDENTITY_TRACKING_RELEASED_AT = "2026-09-21T00:00:00.000Z";

const SPORT_TIERS = [
  { key: "bronze", label: "Bronze", sessions: 40 },
  { key: "silver", label: "Silver", sessions: 80 },
  { key: "gold", label: "Gold", sessions: 120 },
  { key: "platinum", label: "Platinum", sessions: 160 },
  { key: "diamond", label: "Diamond", sessions: 200 },
  { key: "elite", label: "Elite", sessions: 240 },
  { key: "champion", label: "Champion", sessions: 280 },
  { key: "unreal", label: "Unreal", sessions: 320 },
];

const PACK_TONES = {
  avatar_pack_1: ["curiosity", "momentum", "brave beginnings"],
  avatar_pack_2_velocity_pulse: ["speed", "focus", "clean execution"],
  avatar_pack_3_apex_engine: ["precision", "power", "disciplined progress"],
  avatar_pack_4_movement_masters: ["movement", "control", "athletic craft"],
  avatar_pack_5_mythic_guardians: ["courage", "resilience", "protective strength"],
  avatar_pack_6_sport_elites: ["competition", "technique", "game intelligence"],
  avatar_pack_7_ascended_sport_elites: ["mastery", "composure", "elite standards"],
  avatar_pack_8_iconic_legends: ["imagination", "nerve", "unusual solutions"],
  avatar_pack_9_iconic_legends2: ["adaptability", "resolve", "decisive action"],
  avatar_pack_10_prestige_athletes: ["leadership", "performance", "professional habits"],
  avatar_pack_11_cosmic_sprouts: ["discovery", "energy", "bright persistence"],
  avatar_pack_12_bounce_brigade: ["optimism", "agility", "bounce-back spirit"],
  avatar_pack_13_rescue_legends: ["service", "teamwork", "calm under pressure"],
  avatar_pack_14_velvet_icons: ["confidence", "individuality", "creative discipline"],
  avatar_pack_15_neon_cipher_squad: ["ingenuity", "speed", "future-ready focus"],
};

function tidyPackTitle(title = "") {
  return String(title).replace(/^Avatar Pack \d+\s*[–-]\s*/, "").trim() || "Avatar Collection";
}

function storyFor(avatar, pack) {
  const profile = AVATAR_STORY_PROFILES[avatar.id];
  if (profile?.story) return profile.story;
  const [first, second, third] = PACK_TONES[pack.key] || ["focus", "courage", "consistent effort"];
  return `${avatar.label} carries the spirit of ${tidyPackTitle(pack.title)}, turning ${first} into steady progress. Known for ${second}, this character studies the challenge, supports the team, and keeps moving when the easy option disappears. The emblem belongs to athletes who value ${third}, patience, and purposeful effort.`;
}

function traitsFor(avatar, pack) {
  const profile = AVATAR_STORY_PROFILES[avatar.id];
  if (profile?.traits?.length) return profile.traits;
  const tones = PACK_TONES[pack.key] || ["Focused", "Resilient", "Consistent"];
  return tones.slice(0, 3).map((value) => value.replace(/\b\w/g, (letter) => letter.toUpperCase()));
}

const XP_IDENTITIES = new Map(
  AVATAR_PACKS.flatMap((pack) =>
    (pack.avatars || []).map((avatar) => [
      avatar.id,
      {
        ...avatar,
        collectionKey: pack.key,
        collection: tidyPackTitle(pack.title),
        story: storyFor(avatar, pack),
        traits: traitsFor(avatar, pack),
        unlockSource: {
          type: "xp_pack",
          label: `${pack.unlockAtXp.toLocaleString("en-GB")} XP milestone`,
          requirement: { xp: pack.unlockAtXp, packKey: pack.key },
        },
      },
    ])
  )
);

function sportIdentity(avatarId) {
  if (!avatarId?.startsWith("sport_avatar_")) return null;
  const tier = SPORT_TIERS.find((candidate) => avatarId.endsWith(`_${candidate.key}`));
  if (!tier) return null;
  const sportKey = avatarId
    .slice("sport_avatar_".length)
    .slice(0, -(tier.key.length + 1));
  const sport = SPORT_MASTERY_PACKS[sportKey];
  if (!sport) return null;
  const label = `${sport.label} ${tier.label}`;
  return {
    id: avatarId,
    label,
    subtitle: `${sport.label} Mastery`,
    imgSrc: `/avatars/sport/${sportKey}_${tier.key}.png`,
    collectionKey: `sport_mastery_${sportKey}`,
    collection: `${sport.label} Mastery`,
    story: `${label} represents the hours when technique becomes instinct. Earned through repeated ${sport.label.toLowerCase()} sessions, this avatar stands for showing up, learning from every attempt, and staying composed under pressure. It marks an athlete who builds mastery through patient practice rather than shortcuts.`,
    traits: ["Committed", "Technical", "Composed"],
    unlockSource: {
      type: "sport_mastery",
      label: `${tier.sessions} counted ${sport.label} sessions`,
      requirement: { sportKey, sessions: tier.sessions, tier: tier.key },
    },
  };
}

export function resolveAvatarIdentity(avatarId) {
  const id = typeof avatarId === "string" ? avatarId.trim() : "";
  if (!id) return null;
  return XP_IDENTITIES.get(id) || sportIdentity(id) || null;
}

export function listAvatarIdentities() {
  return Array.from(XP_IDENTITIES.values());
}
