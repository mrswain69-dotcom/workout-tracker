# Workout Tracker — Post-10k Avatar & Rewards Implementation Specification v1.0

**Status:** Canonical production specification  
**Date locked:** 2026-09-19  
**Repository:** `mrswain69-dotcom/workout-tracker`  
**Primary config:** `src/config/avatars.js`  
**Asset root:** `public/avatars/`

> This document is the single implementation reference for the post-10,000 XP avatar expansion. When future chat discussions conflict with this document, update this document deliberately rather than silently drifting the design.

## 1. Objective

Extend the existing XP avatar journey beyond 10,000 XP without diluting the value of what has already been earned.

The expansion must:
- preserve the existing 1k-10k journey;
- make every new unlock feel materially different;
- use **8 avatars per XP unlock pack**;
- broaden the universe beyond conventional human athletes;
- maintain a crisp, premium stylised 3D game-skin finish;
- avoid recolour packs, repeated body templates and “more aura = more prestige” design drift;
- remain scalable beyond 35k, 60k, 120k and future XP levels;
- integrate with existing Rewards, Dashboard, header avatar and Group identity behaviour without a data migration.

## 2. Existing implementation facts

Current production behaviour already gives us several useful compatibility guarantees:

- `AVATAR_PACKS` is the authority for XP avatar pack thresholds and avatar identity metadata.
- Claimed pack keys are stored in profile plan metadata at `plan_json.meta.unlockedAvatarPacks`.
- The selected avatar ID is stored at `plan_json.meta.avatarId`.
- Group identity resolves selected XP avatars from the same `AVATAR_PACKS` config.
- Dashboard “next avatar reward” already derives the next threshold from `AVATAR_PACKS`, so new configured milestones automatically extend Dashboard progression.
- Rewards already applies prestige roster styling to packs at 10,000 XP+.
- Header prestige-frame detection already recognises `/avatars/pack10/` and later two-digit pack folders.
- No database schema migration is required for new XP avatar packs.

**Important:** do not add a pack to `AVATAR_PACKS` until all 8 referenced assets exist and have passed the art/asset QA gates below. The current Rewards page previews every configured pack, so incomplete config creates broken previews.

## 3. Locked reward cadence

| XP range | Unlock cadence | Pack rule |
|---|---:|---|
| 1k-10k | every 1,000 XP | existing Packs 1-10 |
| 12k-30k | every 2,000 XP | 1 pack = 8 avatars |
| 35k-60k | every 5,000 XP | 1 pack = 8 avatars |
| 70k+ | every 10,000 XP | 1 pack = 8 avatars |

There is deliberately no 11k pack. The post-10k system begins at **12,000 XP**.

Beyond 120k, continue at 10,000 XP intervals using Pack 33 onward. Do not pre-commit every future theme now; preserve creative headroom.

## 4. Reward eras

| Era | Range | Product meaning |
|---|---|---|
| **Athlete Journey** | 1,000-10,000 XP | Existing packs 1-10; no redesign in this specification. |
| **Legends Beyond Sport** | 12,000-20,000 XP | Playful, imaginative, premium characters beyond conventional human athletes. |
| **Elite Machines & Operators** | 22,000-35,000 XP | Machines, operators and elite service-inspired archetypes with stronger status and discipline. |
| **Mythic Prestige** | 40,000-60,000 XP | Rarer, iconic and legendary designs with stronger materials and silhouettes rather than effect spam. |
| **Infinite Mastery** | 70,000+ XP | Ultra-rare long-horizon packs. Continue every 10,000 XP beyond 120k when needed. |

## 5. Repository naming contract

For Pack **N**:

- Folder: `public/avatars/packN/`
- Pack key: `avatar_pack_N_<pack_slug>`
- Avatar ID: `pN_<avatar_snake_case>`
- Image file: `<avatar-kebab-case>.png`
- Image path in config: `/avatars/packN/<avatar-kebab-case>.png`

Example:

```text
public/avatars/pack11/astro-sprout.png
id: p11_astro_sprout
imgSrc: /avatars/pack11/astro-sprout.png
pack key: avatar_pack_11_cosmic_sprouts
```

### Naming requirements

- IDs must be globally unique.
- File names remain lowercase kebab-case.
- New IDs use the explicit `pN_` prefix to avoid collisions with older pack naming conventions.
- Do not reuse an old avatar ID for a redesigned image.
- If an image concept is replaced before release, keep the filename only if the identity/name remains the same; otherwise update ID, filename and config together.

## 6. Config schema

Every released post-10k pack should use this structure:

```js
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
    // 7 more...
  ],
}
```

### Required fields

Pack:
- `key`
- `title`
- `desc`
- `unlockAtXp`
- `prestigePack: true`
- `eraKey`
- `eraTitle`
- exactly 8 `avatars`

Avatar:
- `id`
- `label`
- `imgSrc`
- `prestige: true`
- `subtitle` for Pack 11-15 production; strongly preferred for all later packs

The current app safely ignores unknown metadata fields, so `eraKey` and `eraTitle` can be introduced in config before the Rewards UI begins rendering era headers.

## 7. Full post-10k pack registry


### Legends Beyond Sport

#### Pack 11 — 12,000 XP — Cosmic Sprouts

- Config key: `avatar_pack_11_cosmic_sprouts`
- Folder: `public/avatars/pack11/`
- Description: `Unlock at 12,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Astro Sprout | `p11_astro_sprout` | `astro-sprout.png` |
| Nebula Nib | `p11_nebula_nib` | `nebula-nib.png` |
| Orbit Pop | `p11_orbit_pop` | `orbit-pop.png` |
| Comet Bean | `p11_comet_bean` | `comet-bean.png` |
| Zippy Quark | `p11_zippy_quark` | `zippy-quark.png` |
| Luna Mite | `p11_luna_mite` | `luna-mite.png` |
| Pulse Pix | `p11_pulse_pix` | `pulse-pix.png` |
| Star Pogo | `p11_star_pogo` | `star-pogo.png` |

#### Pack 12 — 14,000 XP — Bounce Brigade

- Config key: `avatar_pack_12_bounce_brigade`
- Folder: `public/avatars/pack12/`
- Description: `Unlock at 14,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Bounce Bolt | `p12_bounce_bolt` | `bounce-bolt.png` |
| Jelly Dash | `p12_jelly_dash` | `jelly-dash.png` |
| Bean Blazer | `p12_bean_blazer` | `bean-blazer.png` |
| Tumble Zap | `p12_tumble_zap` | `tumble-zap.png` |
| Orbit Bop | `p12_orbit_bop` | `orbit-bop.png` |
| Turbo Pip | `p12_turbo_pip` | `turbo-pip.png` |
| Fizz Hopper | `p12_fizz_hopper` | `fizz-hopper.png` |
| Pop Rocket | `p12_pop_rocket` | `pop-rocket.png` |

#### Pack 13 — 16,000 XP — Rescue Legends

- Config key: `avatar_pack_13_rescue_legends`
- Folder: `public/avatars/pack13/`
- Description: `Unlock at 16,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Rescue Rover | `p13_rescue_rover` | `rescue-rover.png` |
| Blaze Pup | `p13_blaze_pup` | `blaze-pup.png` |
| Turbo Terrier | `p13_turbo_terrier` | `turbo-terrier.png` |
| Sky Collie | `p13_sky_collie` | `sky-collie.png` |
| Patch Patrol | `p13_patch_patrol` | `patch-patrol.png` |
| Scout Shepherd | `p13_scout_shepherd` | `scout-shepherd.png` |
| Ember Hound | `p13_ember_hound` | `ember-hound.png` |
| Bolt Beagle | `p13_bolt_beagle` | `bolt-beagle.png` |

#### Pack 14 — 18,000 XP — Velvet Icons

- Config key: `avatar_pack_14_velvet_icons`
- Folder: `public/avatars/pack14/`
- Description: `Unlock at 18,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Velvet Star | `p14_velvet_star` | `velvet-star.png` |
| Nova Chic | `p14_nova_chic` | `nova-chic.png` |
| Gloss Ace | `p14_gloss_ace` | `gloss-ace.png` |
| Luxe Dash | `p14_luxe_dash` | `luxe-dash.png` |
| Runway Rebel | `p14_runway_rebel` | `runway-rebel.png` |
| Satin Spark | `p14_satin_spark` | `satin-spark.png` |
| Gold Glider | `p14_gold_glider` | `gold-glider.png` |
| Prism Pop | `p14_prism_pop` | `prism-pop.png` |

#### Pack 15 — 20,000 XP — Neon Cipher Squad

- Config key: `avatar_pack_15_neon_cipher_squad`
- Folder: `public/avatars/pack15/`
- Description: `Unlock at 20,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Neon Cipher | `p15_neon_cipher` | `neon-cipher.png` |
| Pixel Viper | `p15_pixel_viper` | `pixel-viper.png` |
| Circuit Jax | `p15_circuit_jax` | `circuit-jax.png` |
| Pulse Nova | `p15_pulse_nova` | `pulse-nova.png` |
| Vector Nyx | `p15_vector_nyx` | `vector-nyx.png` |
| Chrome Flicker | `p15_chrome_flicker` | `chrome-flicker.png` |
| Holo Dash | `p15_holo_dash` | `holo-dash.png` |
| Byte Runner | `p15_byte_runner` | `byte-runner.png` |


### Elite Machines & Operators

#### Pack 16 — 22,000 XP — Rocket Rumble Crew

- Config key: `avatar_pack_16_rocket_rumble_crew`
- Folder: `public/avatars/pack16/`
- Description: `Unlock at 22,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Rocket Rumbler | `p16_rocket_rumbler` | `rocket-rumbler.png` |
| Nitro Fang | `p16_nitro_fang` | `nitro-fang.png` |
| Drift Brick | `p16_drift_brick` | `drift-brick.png` |
| Boost Bandit | `p16_boost_bandit` | `boost-bandit.png` |
| Turbo Tank | `p16_turbo_tank` | `turbo-tank.png` |
| Plasma Coupe | `p16_plasma_coupe` | `plasma-coupe.png` |
| Thunder Wagon | `p16_thunder_wagon` | `thunder-wagon.png` |
| Blaze Rocket | `p16_blaze_rocket` | `blaze-rocket.png` |

#### Pack 17 — 24,000 XP — Shadow Recon Unit

- Config key: `avatar_pack_17_shadow_recon_unit`
- Folder: `public/avatars/pack17/`
- Description: `Unlock at 24,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Shadow Recon | `p17_shadow_recon` | `shadow-recon.png` |
| Ghost Ranger | `p17_ghost_ranger` | `ghost-ranger.png` |
| Stealth Vex | `p17_stealth_vex` | `stealth-vex.png` |
| Night Scout | `p17_night_scout` | `night-scout.png` |
| Echo Blade | `p17_echo_blade` | `echo-blade.png` |
| Signal Hawk | `p17_signal_hawk` | `signal-hawk.png` |
| Phantom Trace | `p17_phantom_trace` | `phantom-trace.png` |
| Blackline | `p17_blackline` | `blackline.png` |

#### Pack 18 — 26,000 XP — Tide Vanguard Fleet

- Config key: `avatar_pack_18_tide_vanguard_fleet`
- Folder: `public/avatars/pack18/`
- Description: `Unlock at 26,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Tide Vanguard | `p18_tide_vanguard` | `tide-vanguard.png` |
| Reef Marshal | `p18_reef_marshal` | `reef-marshal.png` |
| Storm Diver | `p18_storm_diver` | `storm-diver.png` |
| Harbor Sentinel | `p18_harbor_sentinel` | `harbor-sentinel.png` |
| Breakwater | `p18_breakwater` | `breakwater.png` |
| Blue Wake | `p18_blue_wake` | `blue-wake.png` |
| Trident Ace | `p18_trident_ace` | `trident-ace.png` |
| Saltstrike | `p18_saltstrike` | `saltstrike.png` |

#### Pack 19 — 28,000 XP — Sky Marshal Wing

- Config key: `avatar_pack_19_sky_marshal_wing`
- Folder: `public/avatars/pack19/`
- Description: `Unlock at 28,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Sky Marshal | `p19_sky_marshal` | `sky-marshal.png` |
| Jetstream | `p19_jetstream` | `jetstream.png` |
| Falcon Vector | `p19_falcon_vector` | `falcon-vector.png` |
| Vapor Wing | `p19_vapor_wing` | `vapor-wing.png` |
| Sonic Pilot | `p19_sonic_pilot` | `sonic-pilot.png` |
| Cloudbreaker | `p19_cloudbreaker` | `cloudbreaker.png` |
| Horizon Ace | `p19_horizon_ace` | `horizon-ace.png` |
| Afterburn | `p19_afterburn` | `afterburn.png` |

#### Pack 20 — 30,000 XP — Iron Revenants

- Config key: `avatar_pack_20_iron_revenants`
- Folder: `public/avatars/pack20/`
- Description: `Unlock at 30,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Iron Revenant | `p20_iron_revenant` | `iron-revenant.png` |
| Steel Warden | `p20_steel_warden` | `steel-warden.png` |
| Core Hunter | `p20_core_hunter` | `core-hunter.png` |
| Volt Marauder | `p20_volt_marauder` | `volt-marauder.png` |
| Alloy Specter | `p20_alloy_specter` | `alloy-specter.png` |
| Titan Shade | `p20_titan_shade` | `titan-shade.png` |
| Chrome Reaper | `p20_chrome_reaper` | `chrome-reaper.png` |
| Rift Machine | `p20_rift_machine` | `rift-machine.png` |

#### Pack 21 — 35,000 XP — Apex Command

- Config key: `avatar_pack_21_apex_command`
- Folder: `public/avatars/pack21/`
- Description: `Unlock at 35,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Apex Commander | `p21_apex_commander` | `apex-commander.png` |
| Command Nova | `p21_command_nova` | `command-nova.png` |
| Vanguard Rex | `p21_vanguard_rex` | `vanguard-rex.png` |
| Prime Admiral | `p21_prime_admiral` | `prime-admiral.png` |
| Marshal Zenith | `p21_marshal_zenith` | `marshal-zenith.png` |
| Crown Operator | `p21_crown_operator` | `crown-operator.png` |
| Peak Sentinel | `p21_peak_sentinel` | `peak-sentinel.png` |
| Summit Chief | `p21_summit_chief` | `summit-chief.png` |


### Mythic Prestige

#### Pack 22 — 40,000 XP — Starforged Sentinels

- Config key: `avatar_pack_22_starforged_sentinels`
- Folder: `public/avatars/pack22/`
- Description: `Unlock at 40,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Starforged Sentinel | `p22_starforged_sentinel` | `starforged-sentinel.png` |
| Solar Guard | `p22_solar_guard` | `solar-guard.png` |
| Void Paladin | `p22_void_paladin` | `void-paladin.png` |
| Meteor Shield | `p22_meteor_shield` | `meteor-shield.png` |
| Aether Knight | `p22_aether_knight` | `aether-knight.png` |
| Quasar Watch | `p22_quasar_watch` | `quasar-watch.png` |
| Halo Bastion | `p22_halo_bastion` | `halo-bastion.png` |
| Orbit Ward | `p22_orbit_ward` | `orbit-ward.png` |

#### Pack 23 — 45,000 XP — Titan Drift Circuit

- Config key: `avatar_pack_23_titan_drift_circuit`
- Folder: `public/avatars/pack23/`
- Description: `Unlock at 45,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Titan Drift | `p23_titan_drift` | `titan-drift.png` |
| Apex Velocity | `p23_apex_velocity` | `apex-velocity.png` |
| Neon Torque | `p23_neon_torque` | `neon-torque.png` |
| Volt Chassis | `p23_volt_chassis` | `volt-chassis.png` |
| Overdrive King | `p23_overdrive_king` | `overdrive-king.png` |
| Shockwave GT | `p23_shockwave_gt` | `shockwave-gt.png` |
| Drift Titan | `p23_drift_titan` | `drift-titan.png` |
| Turbo Monarch | `p23_turbo_monarch` | `turbo-monarch.png` |

#### Pack 24 — 50,000 XP — Omega Core Collective

- Config key: `avatar_pack_24_omega_core_collective`
- Folder: `public/avatars/pack24/`
- Description: `Unlock at 50,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Omega Core | `p24_omega_core` | `omega-core.png` |
| Synapse Prime | `p24_synapse_prime` | `synapse-prime.png` |
| Hexa Pulse | `p24_hexa_pulse` | `hexa-pulse.png` |
| Ion Regent | `p24_ion_regent` | `ion-regent.png` |
| Delta Forge | `p24_delta_forge` | `delta-forge.png` |
| Null Vector | `p24_null_vector` | `null-vector.png` |
| Prism Kernel | `p24_prism_kernel` | `prism-kernel.png` |
| Ultra Node | `p24_ultra_node` | `ultra-node.png` |

#### Pack 25 — 55,000 XP — Valor Beasts

- Config key: `avatar_pack_25_valor_beasts`
- Folder: `public/avatars/pack25/`
- Description: `Unlock at 55,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Valor Beast | `p25_valor_beast` | `valor-beast.png` |
| Crown Wolf | `p25_crown_wolf` | `crown-wolf.png` |
| Iron Mane | `p25_iron_mane` | `iron-mane.png` |
| Frost Panther | `p25_frost_panther` | `frost-panther.png` |
| Ember Claw | `p25_ember_claw` | `ember-claw.png` |
| Thunder Bear | `p25_thunder_bear` | `thunder-bear.png` |
| Shadow Lynx | `p25_shadow_lynx` | `shadow-lynx.png` |
| Golden Fang | `p25_golden_fang` | `golden-fang.png` |

#### Pack 26 — 60,000 XP — Celestial Crown

- Config key: `avatar_pack_26_celestial_crown`
- Folder: `public/avatars/pack26/`
- Description: `Unlock at 60,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Celestial Crown | `p26_celestial_crown` | `celestial-crown.png` |
| Astra Regent | `p26_astra_regent` | `astra-regent.png` |
| Comet Sovereign | `p26_comet_sovereign` | `comet-sovereign.png` |
| Halo Throne | `p26_halo_throne` | `halo-throne.png` |
| Zenith Aura | `p26_zenith_aura` | `zenith-aura.png` |
| Crownflare | `p26_crownflare` | `crownflare.png` |
| Moonfire Majestic | `p26_moonfire_majestic` | `moonfire-majestic.png` |
| Solar Empress | `p26_solar_empress` | `solar-empress.png` |


### Infinite Mastery

#### Pack 27 — 70,000 XP — Paragon Prime

- Config key: `avatar_pack_27_paragon_prime`
- Folder: `public/avatars/pack27/`
- Description: `Unlock at 70,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Paragon Prime | `p27_paragon_prime` | `paragon-prime.png` |
| Apex Aura | `p27_apex_aura` | `apex-aura.png` |
| Infinite Stride | `p27_infinite_stride` | `infinite-stride.png` |
| Platinum Crest | `p27_platinum_crest` | `platinum-crest.png` |
| Honor Pulse | `p27_honor_pulse` | `honor-pulse.png` |
| Victory Titan | `p27_victory_titan` | `victory-titan.png` |
| Zenith Prime | `p27_zenith_prime` | `zenith-prime.png` |
| Atlas Elite | `p27_atlas_elite` | `atlas-elite.png` |

#### Pack 28 — 80,000 XP — Nova Sovereigns

- Config key: `avatar_pack_28_nova_sovereigns`
- Folder: `public/avatars/pack28/`
- Description: `Unlock at 80,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Nova Sovereign | `p28_nova_sovereign` | `nova-sovereign.png` |
| Starlight Regent | `p28_starlight_regent` | `starlight-regent.png` |
| Galaxy Crest | `p28_galaxy_crest` | `galaxy-crest.png` |
| Orbit Emperor | `p28_orbit_emperor` | `orbit-emperor.png` |
| Prism Monarch | `p28_prism_monarch` | `prism-monarch.png` |
| Quasar Crown | `p28_quasar_crown` | `quasar-crown.png` |
| Astro Throne | `p28_astro_throne` | `astro-throne.png` |
| Cosmic Heir | `p28_cosmic_heir` | `cosmic-heir.png` |

#### Pack 29 — 90,000 XP — Inferno Apex

- Config key: `avatar_pack_29_inferno_apex`
- Folder: `public/avatars/pack29/`
- Description: `Unlock at 90,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Inferno Apex | `p29_inferno_apex` | `inferno-apex.png` |
| Ember Titan | `p29_ember_titan` | `ember-titan.png` |
| Lava Sprint | `p29_lava_sprint` | `lava-sprint.png` |
| Blazewing | `p29_blazewing` | `blazewing.png` |
| Pyro Crown | `p29_pyro_crown` | `pyro-crown.png` |
| Magma Sentinel | `p29_magma_sentinel` | `magma-sentinel.png` |
| Heatstorm | `p29_heatstorm` | `heatstorm.png` |
| Ash Volt | `p29_ash_volt` | `ash-volt.png` |

#### Pack 30 — 100,000 XP — Ascendant One

- Config key: `avatar_pack_30_ascendant_one`
- Folder: `public/avatars/pack30/`
- Description: `Unlock at 100,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Ascendant One | `p30_ascendant_one` | `ascendant-one.png` |
| Zenith Soul | `p30_zenith_soul` | `zenith-soul.png` |
| White Nova | `p30_white_nova` | `white-nova.png` |
| Apex Spirit | `p30_apex_spirit` | `apex-spirit.png` |
| Ether Rise | `p30_ether_rise` | `ether-rise.png` |
| Pinnacle Form | `p30_pinnacle_form` | `pinnacle-form.png` |
| Summit Halo | `p30_summit_halo` | `summit-halo.png` |
| Final Light | `p30_final_light` | `final-light.png` |

#### Pack 31 — 110,000 XP — Eternal Vanguard

- Config key: `avatar_pack_31_eternal_vanguard`
- Folder: `public/avatars/pack31/`
- Description: `Unlock at 110,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Eternal Vanguard | `p31_eternal_vanguard` | `eternal-vanguard.png` |
| Immortal Guard | `p31_immortal_guard` | `immortal-guard.png` |
| Timekeeper Prime | `p31_timekeeper_prime` | `timekeeper-prime.png` |
| Legacy Spear | `p31_legacy_spear` | `legacy-spear.png` |
| Iron Eternity | `p31_iron_eternity` | `iron-eternity.png` |
| Myth Anchor | `p31_myth_anchor` | `myth-anchor.png` |
| Evercrest | `p31_evercrest` | `evercrest.png` |
| Epoch Sentinel | `p31_epoch_sentinel` | `epoch-sentinel.png` |

#### Pack 32 — 120,000 XP — Omni Legends

- Config key: `avatar_pack_32_omni_legends`
- Folder: `public/avatars/pack32/`
- Description: `Unlock at 120,000 XP`

| Avatar | Config ID | File |
|---|---|---|
| Omni Legend | `p32_omni_legend` | `omni-legend.png` |
| Allstar Infinite | `p32_allstar_infinite` | `allstar-infinite.png` |
| Crown Beyond | `p32_crown_beyond` | `crown-beyond.png` |
| Total Apex | `p32_total_apex` | `total-apex.png` |
| Cosmo Master | `p32_cosmo_master` | `cosmo-master.png` |
| Grand Unity | `p32_grand_unity` | `grand-unity.png` |
| Ultima Form | `p32_ultima_form` | `ultima-form.png` |
| One Above | `p32_one_above` | `one-above.png` |

## 8. Locked art direction

### 8.1 Quality target

Every new avatar must look like an **original premium stylised 3D game character/skin**, with:
- crisp modelling and edges;
- deliberate, believable materials;
- strong silhouette;
- readable face/head design;
- polished lighting;
- clean, collectible finish;
- visual clarity at small profile-avatar size.

The target is the quality and collectability associated with premium game skins, **not imitation of any specific franchise character or protected design**.

### 8.2 Hard anti-repetition rules

Within every 8-avatar pack:
- no two avatars may be simple recolours of the same base;
- body type/silhouette must change materially across the set;
- face/head construction must vary;
- outfit/armour construction must vary;
- dominant palette must vary;
- trim must vary;
- pose must vary;
- props/accessories must vary;
- material mix must vary;
- personality/read must vary.

Higher XP does **not** mean “add more glow”.

Aura, energy trails and emissive effects are optional accents only. They must never substitute for character design. Aim for **0-2 effect-heavy avatars per pack maximum**, and use none when the concept does not need it.

### 8.3 Pack diversity gate

Before a pack can ship, review all 8 together in a 4×2 contact sheet.

Reject/rework the pack if:
- more than two characters share the same dominant silhouette class;
- more than two characters share essentially the same dominant palette;
- multiple characters reuse the same signature prop;
- three or more characters rely on glow/aura as their main differentiator;
- the set reads as “one model in different outfits”;
- any character becomes unclear at approximately 96×96 px.

### 8.4 Originality and brand safety

- No third-party logos, badges, uniforms or trademarked markings.
- No direct copies of recognisable franchise characters, vehicles, costumes or faces.
- Inspiration can use broad archetypes: cute alien, rescue animal, cybernetic warrior, premium fashion icon, elite operator, performance vehicle, etc.
- Military/service-inspired packs should emphasise discipline, capability, equipment and silhouette rather than real-world unit insignia or weapon fetishisation.
- Rescue-animal characters must remain original and not reproduce a known children's franchise design language.

## 9. Asset production specification

### 9.1 Master output

For every avatar:
- format: PNG with alpha transparency;
- master canvas: **1024 × 1024 px**;
- colour: RGB/RGBA, sRGB;
- background: fully transparent;
- no scenery, floor, vignette or opaque backdrop;
- composition: centred, with approximately 8-10% safe margin around the outer silhouette;
- framing: torso/three-quarter for humanoids where it reads best; full-body or three-quarter allowed for creatures/mascots; vehicles use a three-quarter hero angle;
- no text embedded in the artwork;
- no external logo marks.

### 9.2 Browser asset optimisation

After visual approval:
- preserve alpha;
- optimise PNG without visible banding or edge damage;
- soft target: <=500 KB per asset;
- hard review threshold: 750 KB per asset unless quality materially suffers;
- never reduce resolution below the agreed master without documenting the change.

### 9.3 Rewards performance requirement

The expansion adds 176 new images. The existing Rewards view currently maps configured packs directly, so asset loading must be hardened before or with the first new batch:

- add `loading="lazy"` to XP avatar roster images;
- add `decoding="async"`;
- group packs under era sections;
- prefer collapsed/non-mounted later-era pack content where practical so entering Rewards does not eagerly decode every future image;
- preserve locked preview behaviour.

This performance work is part of the first implementation PR, not optional cleanup.

## 10. Generic generation brief

Use this as the shared baseline for every character, then append the character-specific design matrix details:

> Create an original Workout Tracker avatar with a premium stylised 3D game-skin finish. Crisp modelling, clean silhouette, high-quality materials, polished studio lighting, strong colour separation and collectible character design. Use the specified silhouette, palette, materials, pose and signature feature. Isolate the character on a fully transparent background. Square 1024×1024 composition, centred with safe margin, no scenery, no text, no logos. It must remain readable as a small profile avatar. Do not copy an existing franchise character. Do not add an aura or glow unless the character specification explicitly calls for it.

Each character is generated **individually**. Do not ask the model to generate eight characters in one image.

## 11. Phase A production brief — Packs 11-15

Phase A contains 5 packs / **40 finished avatars**. These 40 establish the post-10k quality bar.


### Pack 11 — Cosmic Sprouts — 12,000 XP

Cute original alien adventurers. The set should feel imaginative and premium rather than babyish. Biological variety is essential: different head structures, limbs, proportions and locomotion.

| Avatar | Subtitle | Silhouette | Dominant palette | Materials / finish | Pose / prop | Signature feature |
|---|---|---|---|---|---|---|---|
| Astro Sprout | Cosmic Scout | compact pear-shaped alien; oversized expressive eyes | mint + coral + graphite | rubberised explorer suit, brushed titanium pack | hands-on-hips hero stance; mini rocket pack | leaf-like antenna crest |
| Nebula Nib | Three-Eye Explorer | tall narrow alien; three eyes; long soft limbs | indigo + lime + pale grey | woven space fabric, translucent collar | curious low crouch; scanner puck | forked ear-fins |
| Orbit Pop | Hover Trickster | round orb body; tiny feet; floating glove modules | cobalt + yellow + white | high-gloss shell, soft joint material | mid-hover wave; detached magnetic gloves | floating ring belt |
| Comet Bean | Armoured Comet | squat armoured alien; four compact arms | turquoise + magenta + charcoal | ceramic plates, padded under-suit | forward lean; comet-scarf swept sideways | asymmetric crown ridge |
| Zippy Quark | Sprint Alien | spring-legged, long-eared runner silhouette | burnt orange + teal + cream | neoprene suit, chrome ankle hardware | explosive sprint launch | elastic blade-like ears |
| Luna Mite | Lunar Explorer | tiny bug-like alien; crescent horns; large boots | white + lilac + navy | matte lunar shell, quilted fabric | one-foot perch; compact sample scoop | crescent horn profile |
| Pulse Pix | Tech Sprite | small bio-mech alien; angular hooded head | black + cyan + red | hard-shell chest, cloth hood, soft rubber limbs | confident finger point; wrist tool | pixel-fin cheek plates |
| Star Pogo | Spring Jumper | wide amphibious alien; huge grin; spring boots | purple + gold + aqua | vinyl body suit, rubber spring hardware | compressed pogo stance ready to jump | star-shaped pupils |


### Pack 12 — Bounce Brigade — 14,000 XP

Rounded game mascots with highly readable shapes. Simplicity is allowed, sameness is not. Every mascot needs a distinct body geometry and physical gimmick.

| Avatar | Subtitle | Silhouette | Dominant palette | Materials / finish | Pose / prop | Signature feature |
|---|---|---|---|---|---|---|---|
| Bounce Bolt | Shock Mascot | wedge-shaped rounded mascot; broad shoulders | electric blue + orange + white | padded polymer, knit gloves | playful boxer stance | single lightning eyebrow mark |
| Jelly Dash | Gel Runner | translucent jelly body; narrow waist; soft wobble form | aqua + hot pink + pearl | gel body, cloth headband, rubber soles | mid-run lean | suspended bead bubbles inside body |
| Bean Blazer | Varsity Icon | tall bean silhouette; oversized jacket and shoes | crimson + cream + navy | knit varsity jacket, faux leather trim | arms folded, relaxed swagger | giant sculpted high-tops |
| Tumble Zap | Crash Mascot | short cube-bean; asymmetric helmet | acid green + black + violet | matte foam armour, glossy visor | dynamic side tumble freeze-frame | offset half-helmet |
| Orbit Bop | Ring Dancer | donut/ring torso with small limbs | violet + cyan + silver | satin shell, soft-touch gloves | one-arm wave; rhythmic hip tilt | body-integrated orbit ring |
| Turbo Pip | Mini Racer | tiny chunky mascot; oversized goggles | sun yellow + navy + red | canvas race overalls, molded pads | feet-wide start-line stance | huge twin-lens goggles |
| Fizz Hopper | Bubble Hopper | rounded rabbit-eared mascot; long bubble ears | coral + mint + cream | rubberised suit, translucent ear tips | mid-hop compression | bubble-filled ear ends |
| Pop Rocket | Launch Mascot | rocket-shaped body with stubby arms and nozzle feet | red + white + cobalt | enamel body panels, fabric gloves | forward blast-off lean | twin nozzle boots |


### Pack 13 — Rescue Legends — 16,000 XP

Original rescue-animal heroes. Avoid matching any known rescue-cartoon uniforms. Build identity through breed/body shape, technical rescue equipment, colour/material choices and job function.

| Avatar | Subtitle | Silhouette | Dominant palette | Materials / finish | Pose / prop | Signature feature |
|---|---|---|---|---|---|---|---|
| Rescue Rover | Search Leader | medium athletic rescue dog; balanced proportions | sand + navy + teal | technical utility vest, reflective webbing | alert standing pose; rope coil | large quick-release rescue buckle |
| Blaze Pup | Fire Rescue | compact spotted dog; proud chest | black + white + rescue red | heat-resistant vest, matte visor hardware | proud seated-to-ready stance | fold-down smoke visor |
| Turbo Terrier | Trail Specialist | small wiry terrier; lean sprint silhouette | lime + graphite + cream | light trail harness, mesh pouching | fast forward sprint | compact first-aid side pouch |
| Sky Collie | Air Search | long-coated collie-type dog; aerodynamic profile | sky blue + white + orange | flight-rescue jacket, lightweight wing harness | ears-back running stance | wing-shaped harness yoke |
| Patch Patrol | Heavy Rescue | stocky mastiff/bulldog-type dog; broad neck | rust + cream + navy | rugged padded vest, thick webbing | wide planted stance | oversized utility clasp |
| Scout Shepherd | Tracking Specialist | tall shepherd-type dog; upright ears | tan + black + forest green | search harness, weatherproof fabric | nose-forward tracking pose | cylindrical map/tool carrier |
| Ember Hound | Thermal Search | sleek sighthound; long neck and limbs | charcoal + copper + amber | reflective technical vest, heat-shield collar | elongated ready stance | copper thermal sensor collar |
| Bolt Beagle | Comms Scout | compact long-eared hound; playful build | tricolour + cyan + yellow | radio harness, soft impact pads | one paw raised, attentive | ear-mounted fictional comms clip |


### Pack 14 — Velvet Icons — 18,000 XP

Premium fashion/lifestyle heroes. Crisp game-skin polish, varied body shapes and styling. Confidence and design sophistication matter more than visual effects.

| Avatar | Subtitle | Silhouette | Dominant palette | Materials / finish | Pose / prop | Signature feature |
|---|---|---|---|---|---|---|---|
| Velvet Star | Tailored Icon | tall clean human silhouette; long tailored lines | plum + ivory + muted gold | velvet-texture jacket, crisp tailoring, satin trim | relaxed weight-shift stance | sculptural performance trainers |
| Nova Chic | Metallic Editorial | sharp asymmetrical human silhouette; cropped geometry | silver + ink + magenta | brushed metallic coat, matte body suit | hand-on-hip editorial stance | geometric visor-hair accessory |
| Gloss Ace | Moto Luxe | lean androgynous silhouette; fitted technical tailoring | emerald + black + chrome | gloss moto textile, transparent cuff panels | casual forward lean | single translucent forearm cuff |
| Luxe Dash | Sport Tailoring | athletic curving silhouette; pleated movement panels | saffron + cream + graphite | structured sport tailoring, soft technical weave | confident walking stride | architectural belt module |
| Runway Rebel | Layered Street Icon | broad layered silhouette; oversized upper body | cobalt + red + white | premium street textile, padded collar | shoulder-turned swagger pose | towering asymmetric collar |
| Satin Spark | Sculpted Bomber | compact athletic silhouette; cropped jacket volume | teal + bronze + rose | satin bomber, sculpted technical panels | arms crossed, chin raised | bronze modular wrist pieces |
| Gold Glider | Aero Couture | long sweeping silhouette; tapered lower half | black + champagne gold + smoke | aerodynamic coat, matte stretch fabric | coat-sweep walking pose | slim gold visor glasses |
| Prism Pop | Playful Premium | short powerful silhouette; quilted oversized jacket | lavender + cyan + coral | quilted tech textile, smooth molded accessories | playful feet-apart confidence pose | faceted sculptural eyewear |


### Pack 15 — Neon Cipher Squad — 20,000 XP

Cyber/synthetic heroes. Mix human-cyborg, android and non-human robot silhouettes. Prestige comes from industrial design and material contrast, not neon overload.

| Avatar | Subtitle | Silhouette | Dominant palette | Materials / finish | Pose / prop | Signature feature |
|---|---|---|---|---|---|---|---|
| Neon Cipher | Cyber Vanguard | tall human-cyborg; clean split organic/synthetic face | graphite + cyan + gunmetal | carbon fibre, ceramic armour, woven under-suit | neutral commander stance | half-face synthetic plate |
| Pixel Viper | Agile Hacker | slender runner silhouette; compact shoulders; long legs | violet + lime + charcoal | flex fabric, translucent panels, soft armour | side crouch ready to move | segmented wraparound visor |
| Circuit Jax | Heavy Exo Athlete | large heavyweight human silhouette; mechanical forearms | cobalt + orange + black | brushed metal exo-frame, neoprene body suit | feet planted, fists low | exposed piston forearms |
| Pulse Nova | Ceramic Android | compact feminine android; smooth sculpted shell | white + crimson + rose metal | high-gloss ceramic, satin metal joints | poised upright presentation stance | crescent sensor crown |
| Vector Nyx | Masked Synthetic | lanky masked figure; triangular shoulder/head geometry | navy + copper + smoke | woven tactical tech, carbon shell | three-quarter side stance | triangular sensor fins |
| Chrome Flicker | Asymmetric Robot | non-human robot; one oversized shoulder and offset torso | mirror silver + black + electric blue | polished chrome shell, rubberised joints | dynamic torso twist | camera-shutter face aperture |
| Holo Dash | Transparent Tech Runner | athletic human silhouette; light layered jacket | teal + magenta + smoke grey | transparent polymer jacket, technical fabric | sprinter start stance | clear layered jacket panels |
| Byte Runner | Street Bot | compact biped robot; oversized shoes; boxy torso | amber + black + cream | anodised aluminium, fabric wraps, rubber soles | casual jogging pose | cassette-like chest module |

## 12. Pack 11-15 subtitles and config data

The subtitles in the Phase A design matrix are the initial production subtitles and should be stored in each avatar config object.

For Packs 16-32, subtitle wording is deliberately **not locked yet**. Add those subtitles during each later pack's art-production pass so the copy matches the final approved design rather than forcing art to match premature wording.

## 13. Rewards UI implementation

When the first post-10k batch is released:

1. Group XP avatar packs by `eraKey` and render an era heading/short descriptor.
2. Keep pack claim authority unchanged: XP must meet `unlockAtXp`.
3. Keep pack claims in `plan_json.meta.unlockedAvatarPacks`.
4. Keep selected identity in `plan_json.meta.avatarId`.
5. Continue showing locked pack art as classified previews.
6. Keep prestige frame support for 10k+ avatars.
7. Dashboard continues using `AVATAR_PACKS` to find the next unlock.
8. Rewards should continue to show:
   - XP this week as short-horizon motivation;
   - total XP as long-horizon reward authority;
   - next avatar milestone and XP remaining.

### Era headings

Use:
- **Athlete Journey** — 1k-10k
- **Legends Beyond Sport** — 12k-20k
- **Elite Machines & Operators** — 22k-35k
- **Mythic Prestige** — 40k-60k
- **Infinite Mastery** — 70k+

Do not use language implying the user has “finished” the system at 60k or 120k.

## 14. Release batching

### Batch A — 12k-20k
Packs 11-15: 40 avatars.

### Batch B — 22k-35k
Packs 16-21: 48 avatars.

### Batch C — 40k-60k
Packs 22-26: 40 avatars.

### Batch D — 70k-120k
Packs 27-32: 48 avatars.

Do not hold Batch A until all 176 avatars are produced. Release in verified batches so quality remains controllable.

## 15. Production workflow for each pack

1. **Design sheet lock**
   - 8 names;
   - subtitle;
   - silhouette;
   - palette;
   - materials;
   - pose/prop;
   - signature feature.

2. **Generate each avatar individually**
   - use the generic generation brief plus the avatar row;
   - transparent background;
   - no text/logo.

3. **Character-level QA**
   - clean anatomy/geometry;
   - clean transparency;
   - no unwanted objects;
   - no franchise resemblance;
   - no cropped critical features;
   - readable at 96 px.

4. **Pack contact-sheet QA**
   - create 4×2 comparison;
   - check silhouette and palette diversity;
   - reject duplicated visual language;
   - check that prestige is coming from design, not effects.

5. **Asset normalisation**
   - 1024×1024;
   - transparent PNG;
   - optimised file weight;
   - exact agreed filename.

6. **Repository implementation**
   - add `public/avatars/packN/*.png`;
   - add pack to `AVATAR_PACKS`;
   - add/adjust era UI and lazy loading when required;
   - add tests.

7. **App QA**
   - Rewards locked preview;
   - claim at exact threshold;
   - select all 8;
   - header avatar;
   - prestige frame;
   - Group identity;
   - Dashboard next reward;
   - mobile and desktop layout.

8. **Release gate**
   - tests pass;
   - build passes;
   - security audit passes;
   - visual Rewards QA passes;
   - Vercel deployment succeeds.

## 16. Automated tests required

At minimum, add/extend tests covering:

- every post-10k pack has exactly 8 avatars;
- pack XP thresholds are strictly increasing;
- thresholds equal the locked roadmap;
- every avatar ID is globally unique;
- every `imgSrc` is unique;
- every post-10k image path uses the correct `/avatars/packN/` folder;
- every post-10k avatar has `prestige: true`;
- every post-10k pack has `prestigePack: true`;
- every configured image file exists in `public/`;
- Dashboard next-reward logic reaches 12k, 14k, etc. correctly;
- a 10k+ avatar is recognised as prestige/header-frame eligible;
- Rewards image markup uses lazy loading / async decoding after the expansion.

## 17. Visual acceptance checklist

A pack is green only if all answers are YES:

- Do all 8 look like different characters rather than variants?
- Are silhouettes clearly distinguishable before looking at colour?
- Is there genuine palette variety?
- Are materials and trim varied?
- Are poses varied?
- Are signature features unique?
- Are effects restrained?
- Does each character look premium and crisp?
- Does each work at profile-avatar size?
- Are all backgrounds genuinely transparent?
- Are there no third-party logos/design copies?
- Does the pack feel worth the XP milestone?
- Does the pack still leave visual room for the next era to escalate through concept quality?

## 18. Continuation beyond 120k

The reward system must never terminate silently.

After Pack 32 / 120,000 XP:
- continue every 10,000 XP;
- number new releases Pack 33 onward;
- use either an original new collection, a genuinely redesigned “legend edition”, or a specialist prestige collection;
- do not use simple recolours as a full pack;
- a variant/evolution is acceptable only when the model, silhouette, materials or construction are meaningfully redesigned.

Future specialist reward branches (Strength, Football, Endurance, Recovery, Consistency) remain separate from the main XP pack cadence and should be earned from relevant behaviour rather than raw minutes.

## 19. First execution sequence

The next working sequence is locked as:

1. implement the Rewards performance/era scaffolding required for scale;
2. produce Pack 11 design assets from the detailed matrix;
3. contact-sheet review Pack 11;
4. implement Pack 11 at 12k and validate end-to-end;
5. produce Packs 12-15 using the same quality bar;
6. release Batch A (12k-20k);
7. move to Batch B.

This specification should be updated only when a deliberate product/art decision changes. Do not recreate the roadmap from memory in future chats; reference this document.
