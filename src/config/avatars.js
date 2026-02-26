// src/config/avatars.js

// V1 avatar packs (emoji pack + Velocity Pulse pack)

export const AVATAR_PACKS = [
  {
    key: "avatar_pack_1",
    title: "Avatar Pack 1",
    desc: "Unlock at 1,000 XP",
    unlockAtXp: 1000,
    // Emoji-based starter pack
    avatars: [
      { id: "emoji_rocket", label: "Rocket", emoji: "🚀" },
      { id: "emoji_bolt", label: "Bolt", emoji: "⚡" },
      { id: "emoji_tiger", label: "Tiger", emoji: "🐯" },
      { id: "emoji_dragon", label: "Dragon", emoji: "🐉" },
      { id: "emoji_fire", label: "Flame", emoji: "🔥" },
      { id: "emoji_star", label: "Star", emoji: "⭐" },
    ],
  },
  {
    key: "avatar_pack_2_velocity_pulse",
    title: "Avatar Pack 2 – Velocity Pulse",
    desc: "Unlock at 2,000 XP",
    unlockAtXp: 2000,
    // Tier 2 image avatars
    avatars: [
      {
        id: "vp_velocity_pulse",
        label: "Velocity Pulse",
        imgSrc: "/avatars/velocity-pulse.png",
      },
      {
        id: "vp_focus_halo",
        label: "Focus Halo",
        imgSrc: "/avatars/focus-halo.png",
      },
      {
        id: "vp_iron_shield",
        label: "Iron Shield",
        imgSrc: "/avatars/iron-shield.png",
      },
      {
        id: "vp_streak_flame",
        label: "Streak Flame",
        imgSrc: "/avatars/streak-flame.png",
      },
      {
        id: "vp_precision_target",
        label: "Precision Target",
        imgSrc: "/avatars/precision-target.png",
      },
      {
        id: "vp_winged_sprint",
        label: "Winged Sprint",
        imgSrc: "/avatars/winged-sprint.png",
      },
    ],
  },
];