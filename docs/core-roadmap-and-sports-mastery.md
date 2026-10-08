# Core roadmap and sports mastery

Updated 8 October 2026. This reconciles the live programme/Community build with the core rewards roadmap. Older phase documents describe their original delivery scope and may still list features subsequently delivered.

## Current sequence

1. Badge audit and sports mastery prestige foundation (this change).
2. Expand sports coverage and complete sport avatar artwork in batches.
3. Continue XP avatar artwork from Pack 16 (22,000 XP), following the canonical post-10k specification: exactly eight finished assets per configured pack.
4. Body Intelligence: short illustrated lessons on movement anatomy, joints/supporting structures, balance, training principles/recovery, energy systems and nutrition. Content needs appropriate primary references and age-appropriate explanations before publication. No supplement dosing or education XP policy is established by this change.
5. Later programme improvements: email notifications, richer report exports, commercial entitlements and broader device/accessibility checks. Community publishing, discovery, saved programmes, copying, helpful voting, reports/moderation and creator bios/verification already have implementations.
6. Locker/customisation refresh (after the core stages above): replace the Shop name, expand earned sound themes and cosmetic personalisation, with previews and accessibility controls.

## Badge audit findings

- Existing sport mastery badges stopped at Diamond; the separate sport-avatar ladder continued to Unreal.
- Thirteen mastery sports are configured. Football and cricket have complete eight-tier sport-avatar asset sets. Additional sports/artwork remain a separate production phase.
- Maximum one counted session per sport per calendar day remains the rule. Existing recorded partial structured sessions count. Duplicate rows for a day previously bypassed the daily cap; the engine now deduplicates date/sport and ignores future dates. Last activity date now uses the latest date regardless of row ordering.
- Mastery uses named sport activity, not sport-specific performance assessment. Some name aliases are broad (for example bowling under cricket, and Pilates under yoga). Review recognition and separate categories as part of the sports expansion, with historical/earned reward compatibility considered explicitly.
- Performance badges, XP avatar unlocks, selected avatars, historical reward IDs and existing sport-avatar thresholds remain unchanged. Sport-avatar tiers are not reinterpreted as the new badge thresholds.

## Approved badge progression

The user selected the steady progression on 8 October 2026:

| Tier | Counted sessions | One-time badge bonus XP |
| --- | ---: | ---: |
| Bronze | 1 | 20 |
| Silver | 5 | 30 |
| Gold | 15 | 45 |
| Platinum | 40 | 65 |
| Diamond | 80 | 90 |
| Pro | 120 | 110 |
| Champion | 160 | 130 |
| Elite | 240 | 160 |
| Unreal | 320 | 200 |

The first five keys, thresholds and XP awards are preserved. Prestige tiers append keys 6–9. New bonus values follow the existing one-time reward pattern; repeated stars grant no bonus XP. Generated client and Edge reward maps stay identical.

At Diamond, the card displays a compact Diamond achievement marker and Pro/Champion/Elite milestones. At Elite it reveals Unreal, retaining compact previous achievements. The main card is a compact trophy cabinet: best earned badge on the left, next locked target on the right, earlier trophies above, and claimed Unreal stars below the main badge. Tapping any badge or Details opens a native keyboard-accessible full-width popup. History, counts and progress appear there in separately labelled stages. Pro/Champion/Elite are not mounted before Diamond; Unreal is not mounted before Elite, including in history. Milestone status appears on hover/focus rather than in permanent bubbles. Existing claimed tiers remain visible if source logs are subsequently edited.

## Repeat Unreal stars

The first Unreal claim is the main badge, with no repeat star. Star 1 requires 400 counted sessions, star 2 requires 480, then another 80 per star. Each has a unique key `badge_sport_<sport>_mastery_unreal_star_<n>` stored through the existing profile reward metadata path. Historical eligible sessions can unlock the new tiers/stars; the same count cannot unlock the next repeat. Claiming the cabinet’s best earned badge collects any earlier unclaimed base rewards through the existing sequential save path before repeats. A failed save stops the sequence; retry skips already saved rewards. Switching profile also stops the remaining sequence. The repeat-star target remains on the right until claimed, then joins the stars below Unreal. The card shows stars beneath the badge, capping the drawn row at eight stars and displaying a number for further stars.

Claims retain the existing queued profile saves and per-key double-click lock. The handler checks mastery eligibility against current badge stats and latest local claims before saving. This is client eligibility with authenticated owner-scoped profile persistence, not a new server-authoritative anti-cheat service or a cross-device transaction guarantee. A separate hardening phase would be required for that.

## Validation

Regression coverage includes all thirteen sports, old reward identity/XP compatibility, tier boundaries, staged display, repeat thresholds, sport isolation, malformed repeat keys, retained claims after edited logs, duplicate day rows, future-date exclusion, latest-date ordering and generated client/Edge XP map parity. UI checks cover stage-gated history, compact cabinets, previous trophies, next targets, claim failures/double clicks, star display, popup opening/closing and keyboard focus restoration. Existing timezone-sensitive early-bird tests are run with TZ=UTC, matching GitHub's runner.

Physical Galaxy Fold checks and authenticated browser visual verification remain outstanding; this change does not claim these were completed.

### Performance trophy cabinets (8 October 2026)

Performance badges now share the compact trophy cabinet and accessible detail dialog used by sport mastery. Pace, repetition, training totals, behaviour and streak badges retain their existing five tier targets and XP rewards. Pace uses lower-is-better times; missing/zero times cannot earn trophies. Previously claimed trophies remain visible after log edits. A single claim collects eligible unclaimed tiers in order and retries skip rewards already saved.

Detail notes use their own dark-theme styling, avoiding the global white `.mini` panels. Diamond completes performance collections; no prestige milestones or stars are advertised for these cards yet. Future performance prestige needs suitable targets for each metric as well as artwork, rather than reusing sport session counts.

Validation: 1,168 tests across 194 files, production build, badge asset inventory and dependency audit passed. Physical-device and authenticated visual checks remain outstanding.

### Performance prestige and source verification (8 October 2026)

Supersedes the Diamond-only performance limit above: all 64 performance cards now have Pro, Champion, Elite and Unreal, followed by ten zero-XP stars. Existing five-tier targets/rewards remain stable. Pace ceilings use sourced road-running/long-course-swimming references where comparable, and labelled app targets elsewhere. Session Builder and Pace Improvement switch to repeat qualifying days after their existing Diamond requirement. See `docs/performance-prestige-and-verification.md` for the complete target table, benchmark sources and verification rules.

A small gold star at the trophy peak represents supporting linked provider evidence, independently of progression stars. Details include verification status and a collapsed list of contributing log days with direct navigation. Source evidence cannot verify manually entered strength set/rep/weight values. Reward maps are shared with the existing XP services; no database migration or leaderboard rule change is required.

### Locker refresh — queued after the core roadmap

Proposed name: **Locker**, because this is a place to choose earned sounds and appearance rather than a purchasing economy. The current Shop contains Classic, Arcade and Chill victory sound themes; it has no checkout. Keep its existing unlocks and stored selections compatible.

Planned scope:
- More short sound themes for workout completion, badge claims and milestones, with a preview button before selection. Separate celebration and timer sounds so practical cues stay recognisable.
- Earned avatar frames, profile titles, accent themes and optional celebration effects, with a live preview using the user's avatar.
- Saved personalisation presets, clear equipped/available/locked states and a concise explanation of each unlock requirement.
- Independent sound volume and mute controls, reduced-motion support and equivalent visual cues. Respect browser audio restrictions and avoid downloading every sound at page load.
- No spending or subtracting ranking XP, no paid performance advantages, and no changes to existing badge qualifications. Final unlock thresholds and sound assets will be reviewed in this phase.

Inspiration: Fortnite's Locker groups cosmetic choices including emotes and music; Garmin Connect uses earned badges and challenge milestones. Adopt the useful collection/preview and achievement patterns, without introducing a paid item-shop economy. Sources: https://www.fortnite.com/news/stw-locker-blog-1 and https://www.garmin.com/en-US/blog/general/garmin-connect-challenges/ .

### Sport avatar batch 1 — Rugby (8 October 2026)

Rugby now joins Football and Cricket with eight finished transparent portraits, character-specific stories and traits, and the existing identity/selection workflow. Avatar thresholds remain 40/80/120/160/200/240/280/320 counted sessions (Bronze/Silver/Gold/Platinum/Diamond/Elite/Champion/Unreal). Avatar rewards and their historical keys are unchanged. There is no Pro avatar in the existing eight-tier avatar ladder; badge progression remains separate.

Collections awaiting artwork show a clear coming-soon message and retain session progress. They do not request missing portraits or offer new claims before their collection is ready. Previously recorded reward keys remain stored. Portraits load lazily in the collection; the original generated alpha is preserved.

Next artwork batches: Basketball and Tennis, followed by the remaining configured mastery sports. Sport recognition/category expansion still requires a historical compatibility review. Pack 16 and Body Intelligence follow in the sequence above; the Locker refresh stays last.

Validation: 1,184 tests across 196 files, production build, complete published-avatar PNG inventory and dependency audit passed. Original RGBA portraits are preserved; there are no XP map, database or reward-value changes. Physical-device and authenticated visual checks remain outstanding. Generation brief: `docs/rugby-avatar-artwork.md`.

### Paired sport-avatar production brief (8 October 2026)

The user's updated direction is two equally prestigious male/female versions at every avatar tier, earned together through one unchanged unlock. Prestige should follow the established football kit/accessory/award story, ending with formal sport honours; recolours or additional glow are insufficient. Yoga uses non-competitive practice recognition. Martial Arts artwork must not imply a real belt qualification.

Canonical handoff: `docs/avatar-production/paired-sport-avatar-briefs.md` and its JSON prompt source. All thirteen configured sports are covered: 104 tier briefs, 208 final portrait slots. The helper `scripts/sport_avatar_prompt.py` prints one ready-to-use prompt or the target inventory without generating images. `production-status.json` starts every paired slot as not started.

The first production step after switching to Light is the Football Bronze male/female pilot pair. Review the formal Unreal pair next, then finish Football, Rugby and Cricket before the remaining sport batches. Preserve legacy files and reward keys; the variant toggle is future integration work. No paired artwork or toggle is delivered by this brief-only update. Locker remains last in the roadmap.

### Football paired collection (8 October 2026)

The first complete paired sport collection ships all sixteen Football portraits through Unreal. Male/female previews are cosmetic choices on the same earned identity, with explicit application, persisted appearance and shared group cosmetics. Existing equipped originals remain until users choose the new artwork. See `avatar-production/football-paired-release.md`. The other twelve sports remain in the production queue; this release does not mark them complete.
