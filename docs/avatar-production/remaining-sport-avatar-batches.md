# Remaining sport-avatar batches — Sol Light handoff

8 October 2026. Football's sixteen paired portraits and persisted selector are live. The production inventory has **192 remaining portraits: twelve sports, eight tiers, two appearances**. The latest main branch also contains the header notification bell update; start from current main to preserve other work.

## Production sequence

Each numbered row is one independently resumable and releasable collection. Finish one sport before moving to the next. Basketball/Tennis, Badminton/Netball/Hockey, Fencing/Martial Arts and the two rowing categories are related waves, but remain separate sixteen-image batches.

| Batch | Sport | Portraits | Formal Unreal honour |
| --- | --- | ---: | --- |
| 1 | Rugby | 16 | One original polished silver player-of-the-year honour with a stylised oval-ball motif. |
| 2 | Cricket | 16 | One original overall-cricketer-of-the-year honour. |
| 3 | Basketball | 16 | One original gold basketball career-excellence/MVP honour; one ring as a secondary detail. |
| 4 | Tennis | 16 | One original crystal-and-gold year-end/career-excellence tennis honour. |
| 5 | Badminton | 16 | Original crystal-and-gold global-excellence honour with a subtle shuttle motif. |
| 6 | Netball | 16 | Original gold-and-crystal world-player-excellence netball honour. |
| 7 | Hockey | 16 | Original silver-and-gold global-player honour with subtle field-hockey motif. |
| 8 | Fencing | 16 | Original silver-and-gold global-fencing-excellence honour with elegant blade motif. |
| 9 | Martial Arts | 16 | Original gold-and-crystal lifelong-mastery honour, explicitly a fictional app symbol. |
| 10 | Indoor Rowing | 16 | Original silver-and-gold global indoor-rowing excellence honour with flywheel motif. |
| 11 | Outdoor Rowing | 16 | Original silver-and-gold rower/crew-excellence honour with abstract oar motif. |
| 12 | Yoga | 16 | One original crystal-and-gold lifelong-practice honour, explicitly a fictional app symbol. |

Yoga comes last because it uses practice recognition rather than competition trophies. Martial Arts uses fictional mastery recognition, with no session-earned belt ranks. Indoor Rowing uses erg/flywheel imagery; Outdoor Rowing uses oar/regatta imagery. Apply the complete sport-specific kit, equipment, identities and tier awards from the canonical JSON rather than inferring a story from this summary.

## Five manageable passes per collection

| Pass | Tiers, both appearances | Portraits | Checkpoint |
| --- | --- | ---: | --- |
| 1 | Bronze | 2 | Establish this sport's two distinct character anchors and junior practical kit. |
| 2 | Unreal | 2 | Check mature formal portraits and equivalent final honours. |
| 3 | Silver, Gold | 4 | Academy-to-competitive development and early awards. |
| 4 | Platinum, Diamond | 4 | Established athlete, club/national/major award progression. |
| 5 | Elite, Champion | 4 | Peak playing/practice kit and limited award collections. |

Generate one separate portrait per image call. Generate the male member of a tier first, then use it as a kit/award counterpart reference for the female, alongside her own character anchor. Inspect and record each pair before continuing. The five passes organise the work; they do not require five extra user approvals. Continue within the user's authorised batch unless a required reference is unavailable or a quality problem cannot be resolved.

## Art direction and references

The approved Football paired assets are rendering references. Each new sport has its own fictional male and female identity specified in `paired-sport-avatar-briefs.json`; do not copy Football faces, footballs or football awards into another sport. Existing Rugby artwork is a finish reference only: replace its recolour-based progression with the revised kit/awards story. Existing Cricket art also grounds its established direction. Inspect reference files before generation.

For each later tier, reference that variant's own Bronze anchor; use its Unreal anchor when needed to reinforce adult identity. Match the corresponding male/female tier's kit quality, award size and stature. Bronze has no award; Unreal has formal trousers/suit and the final honour, with sport equipment omitted. Full body through Champion; deliberate head-to-mid-thigh crop at Unreal. Aim for square 1024 px or larger, real alpha and clear transparent space around the full playing silhouette. Check equipment, hands, trophy count, no lettering/logos, and readability at the app's small gallery size. Use original trophy silhouettes; named honours in the brief are inspiration, not factual user achievements.

## Checkpoints and cost control

- Read shared rules and the current sport's structured brief once; compose individual prompts with `scripts/sport_avatar_prompt.py`. Other sports' full text need not be loaded for each image.
- Generate only the active collection. No speculative reruns, contact sheets, unrelated art or automatic expansion to all 192 slots.
- After each pair, copy checked assets into their exact v2 filenames, update `production-status.json`, and commit/sync a working branch so an interrupted session resumes from saved work. Record output dimensions, references and any revision reason. Keep generation originals available.
- Reuse completed, approved assets. Regenerate only a specific failed portrait with a recorded reason; keep its paired counterpart as a consistency reference.
- Record a sport as released only after all sixteen assets and its integration checks pass. Summarise the completed batch, the remaining count and exact next sport on handoff.
- Sol Light is the requested text-agent mode. The operator must select it before production; an agent must not claim to switch models or substitute a differently named model without explaining the limitation.

## App integration for each finished collection

Football established the appearance system. Extend it rather than rebuilding it:

1. Add the completed sport to `PAIRED_SPORT_AVATAR_ARTWORK_READY` in `src/config/sportAvatarArtwork.js`; extend `hasSportAvatarArtwork` to recognise either a completed legacy or paired collection, and add it to the legacy-ready list only if complete legacy files really exist. For sports with no legacy collection, make the resolver default to the ready male v2 portrait when no paired preference exists; keep existing Football/Cricket/Rugby legacy defaults intact. Reuse one earned logical identity for both appearances.
2. Ship an additive Supabase migration expanding the supported sport IDs in `set_profile_avatar_appearance`. Its current allowlist accepts Football only. Preserve owner, already-claimed reward, variant validation, empty search path, sanitized appearance and atomic history handling. Update local migration/tests and deploy the schema before clients can select that sport.
3. Check header, dashboard, identity dialogs and current group member/weekly XP/consistency displays. When a recorded historical identity differs from today's directory identity, retain its established fallback behaviour. Keep `avatarId`, thresholds, reward values, XP maps and existing selection periods unchanged.
4. Check all sixteen actual PNGs, valid/invalid paths, legacy fallback, no extra claim/XP on switching, and rollback-tested owner/unlock/group-sync/history behaviour. Run the UTC test suite and production build after code changes; verify the narrow selector and dialog layout.
5. Sync latest main, preserve concurrent work, use the existing GitHub/Vercel workflow, and verify the live asset hashes and app deployment. Existing originals are retained.

For new sports without legacy artwork, test both the paired selector and the default image path so users without appearance metadata never request nonexistent `{sport}_{tier}.png` files. Do not mark an entire missing legacy collection ready as a workaround.

## Scope after these batches

The twelve paired sport collections complete this artwork programme. Pack 16 at 22,000 XP, Body Intelligence education, later programme improvements and the Locker refresh remain their own roadmap stages. This handoff does not start those tasks.

Machine-readable queue: `remaining-sport-avatar-batches.json`. Ready-to-paste production instruction: `sol-light-production-handoff.md`.
