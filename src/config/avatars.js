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
  title: "Avatar Pack 8 – Apex Beings",
  desc: "Unlock at 8,000 XP",
  unlockAtXp: 8000,
  avatars: [
    {
      id: "il_tech_sniper",
      label: "Tech Sniper",
      imgSrc: "/avatars/pack8/tech-sniper.png",
    },
    {
      id: "il_void_weaver",
      label: "Void Weaver",
      imgSrc: "/avatars/pack8/void-weaver.png",
    },
    {
      id: "il_frost_warden",
      label: "Frost Warden",
      imgSrc: "/avatars/pack8/frost-warden.png",
    },
    {
      id: "il_pyro_alchemist",
      label: "Pyro Alchemist",
      imgSrc: "/avatars/pack8/pyro-alchemist.png",
    },
    {
      id: "il_natures_whisper",
      label: "Nature's Whisper",
      imgSrc: "/avatars/pack8/natures-whisper.png",
    },
    {
      id: "il_chrono_navigator",
      label: "Chrono Navigator",
      imgSrc: "/avatars/pack8/chrono-navigator.png",
    },
    {
      id: "il_electric_rogue",
      label: "Electric Rogue",
      imgSrc: "/avatars/pack8/electric-rogue.png",
    },
    {
      id: "il_bone_reaper",
      label: "Bone Reaper",
      imgSrc: "/avatars/pack8/bone-reaper.png",
    },
  ],
},

{
  key: "avatar_pack_9_iconic_legends2",
  title: "Avatar Pack 9 – Apex Beings 2",
  desc: "Unlock at 9,000 XP",
  unlockAtXp: 9000,
  avatars: [
    {
      id: "il_gravity_monk",
      label: "Gravity Monk",
      imgSrc: "/avatars/pack9/gravity-monk.png",
    },
    {
      id: "il_lunar_beastmaster",
      label: "Lunar Beastmaster",
      imgSrc: "/avatars/pack9/lunar-beastmaster.png",
    },
    {
      id: "il_neon_samurai",
      label: "Neon Samurai",
      imgSrc: "/avatars/pack9/neon-samurai.png",
    },
    {
      id: "il_plasma_engineer",
      label: "Plasma Engineer",
      imgSrc: "/avatars/pack9/plasma-engineer.png",
    },
    {
      id: "il_rift-assassin",
      label: "Rift Assassin",
      imgSrc: "/avatars/pack9/rift-assassin.png",
    },
    {
      id: "il_solar_paladin",
      label: "Solar Paladin",
      imgSrc: "/avatars/pack9/solar-paladin.png",
    },
    {
      id: "il_storm_mechanic",
      label: "Storm Mechanic",
      imgSrc: "/avatars/pack9/storm-mechanic.png",
    },
    {
      id: "il_venom-huntress",
      label: "Venom Huntress",
      imgSrc: "/avatars/pack9/venom-huntress.png",
    },
  ],
},

{
  key: "avatar_pack_10_prestige_athletes",
  title: "Avatar Pack 10 – Prestige Athlete Archetypes",
  desc: "Unlock at 10,000 XP",
  unlockAtXp: 10000,
  prestigePack: true,
  avatars: [
    {
      id: "pa_velocity_ronin",
      label: "Velocity Ronin",
      imgSrc: "/avatars/pack10/velocity-ronin.png",
      prestige: true,
      subtitle: "Sprint Specialist",
    },
    {
      id: "pa_court_architect",
      label: "Court Architect",
      imgSrc: "/avatars/pack10/court-architect.png",
      prestige: true,
      subtitle: "Basketball Strategist",
    },
    {
      id: "pa_hydro_blade",
      label: "Hydro Blade",
      imgSrc: "/avatars/pack10/hydro-blade.png",
      prestige: true,
      subtitle: "Swim / Triathlon Elite",
    },
    {
      id: "pa_glacier_climber",
      label: "Glacier Climber",
      imgSrc: "/avatars/pack10/glacier-climber.png",
      prestige: true,
      subtitle: "Mountain Endurance",
    },
    {
      id: "pa_rugby_titan",
      label: "Rugby Titan",
      imgSrc: "/avatars/pack10/rugby-titan.png",
      prestige: true,
      subtitle: "Power & Impact",
    },
    {
      id: "pa_net_command",
      label: "Net Command",
      imgSrc: "/avatars/pack10/net-command.png",
      prestige: true,
      subtitle: "Volleyball Dominator",
    },
    {
      id: "pa_field_dominator",
      label: "Field Dominator",
      imgSrc: "/avatars/pack10/field-dominator.png",
      prestige: true,
      subtitle: "Hockey Specialist",
    },
    {
      id: "pa_pitch_leader",
      label: "Pitch Leader",
      imgSrc: "/avatars/pack10/pitch-leader.png",
      prestige: true,
      subtitle: "Football Captain",
    },
  ],
},
  
  {
    key: "avatar_pack_11_cosmic_sprouts",
    title: "Avatar Pack 11 – Cosmic Sprouts",
    desc: "Unlock at 12,000 XP",
    unlockAtXp: 12000,
    prestigePack: true,
    eraKey: "legends_beyond_sport",
    eraTitle: "Legends Beyond Sport",
    avatars: [
      {
        id: "p11_astro_sprout",
        label: "Astro Sprout",
        imgSrc: "/avatars/pack11/astro-sprout.png",
        prestige: true,
        subtitle: "Cosmic Scout",
      },
      {
        id: "p11_nebula_nib",
        label: "Nebula Nib",
        imgSrc: "/avatars/pack11/nebula-nib.png",
        prestige: true,
        subtitle: "Three-Eye Explorer",
      },
      {
        id: "p11_orbit_pop",
        label: "Orbit Pop",
        imgSrc: "/avatars/pack11/orbit-pop.png",
        prestige: true,
        subtitle: "Hover Trickster",
      },
      {
        id: "p11_comet_bean",
        label: "Comet Bean",
        imgSrc: "/avatars/pack11/comet-bean.png",
        prestige: true,
        subtitle: "Armoured Comet",
      },
      {
        id: "p11_zippy_quark",
        label: "Zippy Quark",
        imgSrc: "/avatars/pack11/zippy-quark.png",
        prestige: true,
        subtitle: "Sprint Alien",
      },
      {
        id: "p11_luna_mite",
        label: "Luna Mite",
        imgSrc: "/avatars/pack11/luna-mite.png",
        prestige: true,
        subtitle: "Lunar Explorer",
      },
      {
        id: "p11_pulse_pix",
        label: "Pulse Pix",
        imgSrc: "/avatars/pack11/pulse-pix.png",
        prestige: true,
        subtitle: "Tech Sprite",
      },
      {
        id: "p11_star_pogo",
        label: "Star Pogo",
        imgSrc: "/avatars/pack11/star-pogo.png",
        prestige: true,
        subtitle: "Spring Jumper",
      },
    ],
  },

  {
    key: "avatar_pack_12_bounce_brigade",
    title: "Avatar Pack 12 – Bounce Brigade",
    desc: "Unlock at 14,000 XP",
    unlockAtXp: 14000,
    prestigePack: true,
    eraKey: "legends_beyond_sport",
    eraTitle: "Legends Beyond Sport",
    avatars: [
      {
        id: "p12_bounce_bolt",
        label: "Bounce Bolt",
        imgSrc: "/avatars/pack12/bounce-bolt.png",
        prestige: true,
        subtitle: "Shock Mascot",
      },
      {
        id: "p12_jelly_dash",
        label: "Jelly Dash",
        imgSrc: "/avatars/pack12/jelly-dash.png",
        prestige: true,
        subtitle: "Gel Runner",
      },
      {
        id: "p12_bean_blazer",
        label: "Bean Blazer",
        imgSrc: "/avatars/pack12/bean-blazer.png",
        prestige: true,
        subtitle: "Varsity Icon",
      },
      {
        id: "p12_tumble_zap",
        label: "Tumble Zap",
        imgSrc: "/avatars/pack12/tumble-zap.png",
        prestige: true,
        subtitle: "Crash Mascot",
      },
      {
        id: "p12_orbit_bop",
        label: "Orbit Bop",
        imgSrc: "/avatars/pack12/orbit-bop.png",
        prestige: true,
        subtitle: "Ring Dancer",
      },
      {
        id: "p12_turbo_pip",
        label: "Turbo Pip",
        imgSrc: "/avatars/pack12/turbo-pip.png",
        prestige: true,
        subtitle: "Mini Racer",
      },
      {
        id: "p12_fizz_hopper",
        label: "Fizz Hopper",
        imgSrc: "/avatars/pack12/fizz-hopper.png",
        prestige: true,
        subtitle: "Bubble Hopper",
      },
      {
        id: "p12_pop_rocket",
        label: "Pop Rocket",
        imgSrc: "/avatars/pack12/pop-rocket.png",
        prestige: true,
        subtitle: "Launch Mascot",
      },
    ],
  },

  {
    key: "avatar_pack_13_rescue_legends",
    title: "Avatar Pack 13 – Rescue Legends",
    desc: "Unlock at 16,000 XP",
    unlockAtXp: 16000,
    prestigePack: true,
    eraKey: "legends_beyond_sport",
    eraTitle: "Legends Beyond Sport",
    avatars: [
      {
        id: "p13_rescue_rover",
        label: "Rescue Rover",
        imgSrc: "/avatars/pack13/rescue-rover.png",
        prestige: true,
        subtitle: "Search Leader",
      },
      {
        id: "p13_blaze_pup",
        label: "Blaze Pup",
        imgSrc: "/avatars/pack13/blaze-pup.png",
        prestige: true,
        subtitle: "Fire Rescue",
      },
      {
        id: "p13_turbo_terrier",
        label: "Turbo Terrier",
        imgSrc: "/avatars/pack13/turbo-terrier.png",
        prestige: true,
        subtitle: "Trail Specialist",
      },
      {
        id: "p13_sky_collie",
        label: "Sky Collie",
        imgSrc: "/avatars/pack13/sky-collie.png",
        prestige: true,
        subtitle: "Air Search",
      },
      {
        id: "p13_patch_patrol",
        label: "Patch Patrol",
        imgSrc: "/avatars/pack13/patch-patrol.png",
        prestige: true,
        subtitle: "Heavy Rescue",
      },
      {
        id: "p13_scout_shepherd",
        label: "Scout Shepherd",
        imgSrc: "/avatars/pack13/scout-shepherd.png",
        prestige: true,
        subtitle: "Tracking Specialist",
      },
      {
        id: "p13_ember_hound",
        label: "Ember Hound",
        imgSrc: "/avatars/pack13/ember-hound.png",
        prestige: true,
        subtitle: "Thermal Search",
      },
      {
        id: "p13_bolt_beagle",
        label: "Bolt Beagle",
        imgSrc: "/avatars/pack13/bolt-beagle.png",
        prestige: true,
        subtitle: "Comms Scout",
      },
    ],
  },

  {
    key: "avatar_pack_14_velvet_icons",
    title: "Avatar Pack 14 – Velvet Icons",
    desc: "Unlock at 18,000 XP",
    unlockAtXp: 18000,
    prestigePack: true,
    eraKey: "legends_beyond_sport",
    eraTitle: "Legends Beyond Sport",
    avatars: [
      {
        id: "p14_velvet_star",
        label: "Velvet Star",
        imgSrc: "/avatars/pack14/velvet-star.png",
        prestige: true,
        subtitle: "Tailored Icon",
      },
      {
        id: "p14_nova_chic",
        label: "Nova Chic",
        imgSrc: "/avatars/pack14/nova-chic.png",
        prestige: true,
        subtitle: "Metallic Editorial",
      },
      {
        id: "p14_gloss_ace",
        label: "Gloss Ace",
        imgSrc: "/avatars/pack14/gloss-ace.png",
        prestige: true,
        subtitle: "Moto Luxe",
      },
      {
        id: "p14_luxe_dash",
        label: "Luxe Dash",
        imgSrc: "/avatars/pack14/luxe-dash.png",
        prestige: true,
        subtitle: "Sport Tailoring",
      },
      {
        id: "p14_runway_rebel",
        label: "Runway Rebel",
        imgSrc: "/avatars/pack14/runway-rebel.png",
        prestige: true,
        subtitle: "Layered Street Icon",
      },
      {
        id: "p14_satin_spark",
        label: "Satin Spark",
        imgSrc: "/avatars/pack14/satin-spark.png",
        prestige: true,
        subtitle: "Sculpted Bomber",
      },
      {
        id: "p14_gold_glider",
        label: "Gold Glider",
        imgSrc: "/avatars/pack14/gold-glider.png",
        prestige: true,
        subtitle: "Aero Couture",
      },
      {
        id: "p14_prism_pop",
        label: "Prism Pop",
        imgSrc: "/avatars/pack14/prism-pop.png",
        prestige: true,
        subtitle: "Playful Premium",
      },
    ],
  },

  {
    key: "avatar_pack_15_neon_cipher_squad",
    title: "Avatar Pack 15 – Neon Cipher Squad",
    desc: "Unlock at 20,000 XP",
    unlockAtXp: 20000,
    prestigePack: true,
    eraKey: "legends_beyond_sport",
    eraTitle: "Legends Beyond Sport",
    avatars: [
      {
        id: "p15_neon_cipher",
        label: "Neon Cipher",
        imgSrc: "/avatars/pack15/neon-cipher.png",
        prestige: true,
        subtitle: "Cyber Vanguard",
      },
      {
        id: "p15_pixel_viper",
        label: "Pixel Viper",
        imgSrc: "/avatars/pack15/pixel-viper.png",
        prestige: true,
        subtitle: "Agile Hacker",
      },
      {
        id: "p15_circuit_jax",
        label: "Circuit Jax",
        imgSrc: "/avatars/pack15/circuit-jax.png",
        prestige: true,
        subtitle: "Heavy Exo Athlete",
      },
      {
        id: "p15_pulse_nova",
        label: "Pulse Nova",
        imgSrc: "/avatars/pack15/pulse-nova.png",
        prestige: true,
        subtitle: "Ceramic Android",
      },
      {
        id: "p15_vector_nyx",
        label: "Vector Nyx",
        imgSrc: "/avatars/pack15/vector-nyx.png",
        prestige: true,
        subtitle: "Masked Synthetic",
      },
      {
        id: "p15_chrome_flicker",
        label: "Chrome Flicker",
        imgSrc: "/avatars/pack15/chrome-flicker.png",
        prestige: true,
        subtitle: "Asymmetric Robot",
      },
      {
        id: "p15_holo_dash",
        label: "Holo Dash",
        imgSrc: "/avatars/pack15/holo-dash.png",
        prestige: true,
        subtitle: "Transparent Tech Runner",
      },
      {
        id: "p15_byte_runner",
        label: "Byte Runner",
        imgSrc: "/avatars/pack15/byte-runner.png",
        prestige: true,
        subtitle: "Street Bot",
      },
    ],
  },


];

// Post-10k reward eras.
// Keep the pack thresholds themselves in AVATAR_PACKS; these metadata rows only
// organise presentation and future expansion.
export const AVATAR_ERAS = [
  {
    key: "athlete_journey",
    title: "Athlete Journey",
    minXp: 0,
    maxXp: 10000,
    desc: "Build the foundations and unlock the original athlete journey.",
  },
  {
    key: "legends_beyond_sport",
    title: "Legends Beyond Sport",
    minXp: 12000,
    maxXp: 20000,
    desc: "Playful, imaginative prestige characters beyond conventional athletes.",
  },
  {
    key: "elite_machines_operators",
    title: "Elite Machines & Operators",
    minXp: 22000,
    maxXp: 35000,
    desc: "Machines, operators and high-status performance archetypes.",
  },
  {
    key: "mythic_prestige",
    title: "Mythic Prestige",
    minXp: 40000,
    maxXp: 60000,
    desc: "Rarer, iconic designs built through stronger concepts, materials and silhouettes.",
  },
  {
    key: "infinite_mastery",
    title: "Infinite Mastery",
    minXp: 70000,
    maxXp: null,
    desc: "Ultra-rare long-horizon rewards that can continue beyond 120,000 XP.",
  },
];

export function getAvatarEraForPack(pack = {}) {
  const explicit = AVATAR_ERAS.find((era) => era.key === pack?.eraKey);
  if (explicit) return explicit;

  const xp = Number(pack?.unlockAtXp) || 0;
  if (xp <= 10000) return AVATAR_ERAS[0];
  if (xp <= 20000) return AVATAR_ERAS[1];
  if (xp <= 35000) return AVATAR_ERAS[2];
  if (xp <= 60000) return AVATAR_ERAS[3];
  return AVATAR_ERAS[4];
}

export function groupAvatarPacksByEra(packs = AVATAR_PACKS) {
  return AVATAR_ERAS.map((era) => ({
    ...era,
    packs: (Array.isArray(packs) ? packs : []).filter(
      (pack) => getAvatarEraForPack(pack)?.key === era.key
    ),
  })).filter((era) => era.packs.length > 0);
}

export const AVATAR_PACK_GROUPS = groupAvatarPacksByEra();
