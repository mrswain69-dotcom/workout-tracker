# Core roadmap and sports mastery

Updated 8 October 2026. This reconciles the live programme/Community build with the core rewards roadmap. Older phase documents describe their original delivery scope and may still list features subsequently delivered.

## Current sequence

1. Badge audit and sports mastery prestige foundation (this change).
2. Expand sports coverage and complete sport avatar artwork in batches.
3. Continue XP avatar artwork from Pack 16 (22,000 XP), following the canonical post-10k specification: exactly eight finished assets per configured pack.
4. Body Intelligence: short illustrated lessons on movement anatomy, joints/supporting structures, balance, training principles/recovery, energy systems and nutrition. Content needs appropriate primary references and age-appropriate explanations before publication. No supplement dosing or education XP policy is established by this change.
5. Later programme improvements: email notifications, richer report exports, commercial entitlements and broader device/accessibility checks. Community publishing, discovery, saved programmes, copying, helpful voting, reports/moderation and creator bios/verification already have implementations.

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

At Diamond, the card displays a compact Diamond achievement marker and Pro/Champion/Elite milestones. At Elite it reveals Unreal, retaining compact previous achievements. Full history and counting rules are collapsed in a native keyboard-accessible details element. Existing claimed tiers remain visible if source logs are subsequently edited.

## Repeat Unreal stars

The first Unreal claim is the main badge, with no repeat star. Star 1 requires 400 counted sessions, star 2 requires 480, then another 80 per star. Each has a unique key `badge_sport_<sport>_mastery_unreal_star_<n>` stored through the existing profile reward metadata path. Historical eligible sessions can unlock the new tiers/stars; the same count cannot unlock the next repeat. Base rewards are claimed one at a time before repeats. The card shows stars beneath the badge, capping the drawn row at eight stars and displaying a number for further stars.

Claims retain the existing queued profile saves and per-key double-click lock. The handler checks mastery eligibility against current badge stats and latest local claims before saving. This is client eligibility with authenticated owner-scoped profile persistence, not a new server-authoritative anti-cheat service or a cross-device transaction guarantee. A separate hardening phase would be required for that.

## Validation

Regression coverage includes all thirteen sports, old reward identity/XP compatibility, tier boundaries, staged display, repeat thresholds, sport isolation, malformed repeat keys, retained claims after edited logs, duplicate day rows, future-date exclusion, latest-date ordering and generated client/Edge XP map parity. UI checks cover collapsed achievement history and prestige/Unreal milestones. Existing timezone-sensitive early-bird tests are run with TZ=UTC, matching GitHub's runner.

Physical Galaxy Fold checks and authenticated browser visual verification remain outstanding; this change does not claim these were completed.
