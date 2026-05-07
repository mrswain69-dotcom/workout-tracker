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

{
    key: "avatar_pack_5_mythic_guardians",
    title: "Avatar Pack 5 – Mythic Guardians",
    desc: "Unlock at 5,000 XP",
    unlockAtXp: 5000,
    avatars: [
      {
        id: "mg_storm_panther",
        label: "Storm Panther",
        imgSrc: "/avatars/pack5/storm-panther.png",
      },
      {
        id: "mg_titan_rhino",
        label: "Titan Rhino",
        imgSrc: "/avatars/pack5/titan-rhino.png",
      },
      {
        id: "mg_solar_falcon",
        label: "Solar Falcon",
        imgSrc: "/avatars/pack5/solar-falcon.png",
      },
      {
        id: "mg_frost_wolf",
        label: "Frost Wolf",
        imgSrc: "/avatars/pack5/frost-wolf.png",
      },
      {
        id: "mg_magma_gorilla",
        label: "Magma Gorilla",
        imgSrc: "/avatars/pack5/magma-gorilla.png",
      },
      {
        id: "mg_atlas_guardian",
        label: "Atlas Guardian",
        imgSrc: "/avatars/pack5/atlas-guardian.png",
      },
      {
        id: "mg_void_serpent",
        label: "Void Serpent",
        imgSrc: "/avatars/pack5/void-serpent.png",
      },
      {
        id: "mg_aurora_stag",
        label: "Aurora Stag",
        imgSrc: "/avatars/pack5/aurora-stag.png",
      },
    ],
  },

{
    key: "avatar_pack_6_sport_elites",
    title: "Avatar Pack 6 – Sport Elites",
    desc: "Unlock at 6,000 XP",
    unlockAtXp: 6000,
    avatars: [
      {
        id: "se_aero_cyclist",
        label: "Aero Cyclist",
        imgSrc: "/avatars/pack6/aero-cyclist.png",
      },
      {
        id: "se_court_architect",
        label: "Court Architect",
        imgSrc: "/avatars/pack6/court-architect.png",
      },
      {
        id: "se_endurance_phantom",
        label: "Endurance Phantom",
        imgSrc: "/avatars/pack6/endurance-phantom.png",
      },
      {
        id: "se_hydro_blade",
        label: "Hydro Blade",
        imgSrc: "/avatars/pack6/hydro-blade.png",
      },
      {
        id: "se_iron_operator",
        label: "Iron Operator",
        imgSrc: "/avatars/pack6/iron-operator.png",
      },
      {
        id: "se_precision_fighter",
        label: "Precision Fighter",
        imgSrc: "/avatars/pack6/precision-fighter.png",
      },
      {
        id: "se_rally_specialist",
        label: "Rally Specialist",
        imgSrc: "/avatars/pack6/rally-specialist.png",
      },
      {
        id: "se_velocity_striker",
        label: "Velocity Striker",
        imgSrc: "/avatars/pack6/velocity-striker.png",
      },
    ],
  },

{
    key: "avatar_pack_7_ascended_sport_elites",
    title: "Avatar Pack 7 – Ascended Sport Elites",
    desc: "Unlock at 7,000 XP",
    unlockAtXp: 7000,
    avatars: [
      {
        id: "ase_aero_cyclist_v2",
        label: "Aero Cyclist V2",
        imgSrc: "/avatars/pack7/aero-cyclist-v2.png",
      },
      {
        id: "ase_court_architect_v2",
        label: "Court Architect V2",
        imgSrc: "/avatars/pack7/court-architect-v2.png",
      },
      {
        id: "ase_endurance_phantom_v2",
        label: "Endurance Phantom V2",
        imgSrc: "/avatars/pack7/endurance-phantom-v2.png",
      },
      {
        id: "ase_hydro_blade_v2",
        label: "Hydro Blade V2",
        imgSrc: "/avatars/pack7/hydro-blade-v2.png",
      },
      {
        id: "ase_iron_operator_v2",
        label: "Iron Operator V2",
        imgSrc: "/avatars/pack7/iron-operator-v2.png",
      },
      {
        id: "ase_precision_fighter_v2",
        label: "Precision Fighter V2",
        imgSrc: "/avatars/pack7/precision-fighter-v2.png",
      },
      {
        id: "ase_rally_specialist_v2",
        label: "Rally Specialist V2",
        imgSrc: "/avatars/pack7/rally-specialist-v2.png",
      },
      {
        id: "ase_velocity_striker_v2",
        label: "Velocity Striker V2",
        imgSrc: "/avatars/pack7/velocity-striker-v2.png",
      },
    ],
  },

{
  key: "avatar_pack_8_iconic_legends",
  title: "Avatar Pack 8 – Iconic Legends",
  desc: "Unlock at 8,000 XP",
  unlockAtXp: 8000,
  avatars: [
    {
      id: "il_shadow_guardian",
      label: "Shadow Guardian",
      imgSrc: "/avatars/pack8/shadow-guardian.png",
    },
    {
      id: "il_web_sprinter",
      label: "Web Sprinter",
      imgSrc: "/avatars/pack8/web-sprinter.png",
    },
    {
      id: "il_arc_champion",
      label: "Arc Champion",
      imgSrc: "/avatars/pack8/arc-champion.png",
    },
    {
      id: "il_amazon_warrior",
      label: "Amazon Warrior",
      imgSrc: "/avatars/pack8/amazon-warrior.png",
    },
    {
      id: "il_lightning_speedster",
      label: "Lightning Speedster",
      imgSrc: "/avatars/pack8/lightning-speedster.png",
    },
    {
      id: "il_cosmic_panther",
      label: "Cosmic Panther",
      imgSrc: "/avatars/pack8/cosmic-panther.png",
    },
    {
      id: "il_mystic_blademaster",
      label: "Mystic Blademaster",
      imgSrc: "/avatars/pack8/mystic-blademaster.png",
    },
    {
      id: "il_titan_ranger",
      label: "Titan Ranger",
      imgSrc: "/avatars/pack8/titan-ranger.png",
    },
  ],
},
  
];
