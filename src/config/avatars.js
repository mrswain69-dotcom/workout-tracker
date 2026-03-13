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

  // Tier 3 – Apex Engine Series
  {
    key: "avatar_pack_3_apex_engine",
    title: "Avatar Pack 3 – Apex Engine Series",
    desc: "Unlock at 3,000 XP",
    unlockAtXp: 3000,
    avatars: [
      {
        id: "ae_apex_runner",
        label: "Apex Runner",
        imgSrc: "/avatars/pack3/apex-runner.png",
      },
      {
        id: "ae_neural_crown",
        label: "Neural Crown",
        imgSrc: "/avatars/pack3/neural-crown.png",
      },
      {
        id: "ae_reactor_core",
        label: "Reactor Core",
        imgSrc: "/avatars/pack3/reactor-core.png",
      },
      {
        id: "ae_vector_titan",
        label: "Vector Titan",
        imgSrc: "/avatars/pack3/vector-titan.png",
      },
      {
        id: "ae_storm_circuit",
        label: "Storm Circuit",
        imgSrc: "/avatars/pack3/storm-circuit.png",
      },
      {
        id: "ae_precision_orbit",
        label: "Precision Orbit",
        imgSrc: "/avatars/pack3/precision-orbit.png",
      },
      {
        id: "ae_iron_mind",
        label: "Iron Mind",
        imgSrc: "/avatars/pack3/iron-mind.png",
      },
      {
        id: "ae_momentum_drive",
        label: "Momentum Drive",
        imgSrc: "/avatars/pack3/momentum-drive.png",
      },
    ],
    },

  // Tier 4 – Apex Athletes
  {
    key: "avatar_pack_4_movement_masters",
    title: "Avatar Pack 4 – Apex Athletes",
    desc: "Unlock at 4,000 XP",
    unlockAtXp: 4000,
    avatars: [
      {
        id: "mm_velocity_runner",
        label: "Velocity Runner",
        imgSrc: "/avatars/pack4/velocity-runner.png",
      },
      {
        id: "mm_iron_lifter",
        label: "Iron Lifter",
        imgSrc: "/avatars/pack4/iron-lifter.png",
      },
      {
        id: "mm_aero_jumper",
        label: "Aero Jumper",
        imgSrc: "/avatars/pack4/aero-jumper.png",
      },
      {
        id: "mm_shadow_striker",
        label: "Shadow Striker",
        imgSrc: "/avatars/pack4/shadow-striker.png",
      },
      {
        id: "mm_endurance_titan",
        label: "Endurance Titan",
        imgSrc: "/avatars/pack4/endurance-titan.png",
      },
      {
        id: "mm_blaze_sprinter",
        label: "Blaze Sprinter",
        imgSrc: "/avatars/pack4/blaze-sprinter.png",
      },
      {
        id: "mm_storm_cycler",
        label: "Storm Cycler",
        imgSrc: "/avatars/pack4/storm-cycler.png",
      },
      {
        id: "mm_focus_guardian",
        label: "Focus Guardian",
        imgSrc: "/avatars/pack4/focus-guardian.png",
      },
    ],
  },

];

