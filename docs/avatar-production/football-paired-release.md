# Football paired collection — 8 October 2026

All sixteen v2 portraits are ready: Bronze, Silver, Gold, Platinum, Diamond, Elite, Champion and Unreal in male/female versions. Uses the canonical paired sport brief. Bronze pilots were approved before production. Artwork keeps the junior-to-established-athlete progression and equivalent kit/awards; Gold uses a golden boot, Platinum a domestic cup, Diamond a league crown cup, Elite a continental cup, Champion three major cups and Unreal formal dress with a gold football honour.

## Selection and compatibility

Rewards → Avatars → Sport Mastery has a male/female preview selector for Football. Open an already-claimed identity and choose **Use this avatar** to equip the preview. Preview alone does not change the profile. Both versions use the same reward key, unlock count and XP; changing appearance is cosmetic and does not split avatar identity periods.

Original assets remain intact. An existing equipped avatar keeps its original appearance until the user chooses a paired identity. Cricket/Rugby retain their current art. Unfinished paired sports are not published. The production inventory records Football ready and the other 192 portraits not started.

Appearance persists as `plan.meta.sportAvatarAppearance` (`edition: paired_v2`, `variant: male|female`). Header, dashboard, identity dialog and group member/weekly XP/consistency views resolve validated paths. Frozen standings use paired cosmetics only when their recorded avatar matches the current directory identity; old identity snapshots fall back to legacy portraits.

## Database

`set_profile_avatar_appearance` atomically uses the existing identity selector and writes the appearance. Owner authentication, supported collection/variant and already-claimed Football reward checks protect paired selection. It returns the owner's saved plan. The client serialises this with existing metadata writes and guards profile switches. The group directory exposes only the two cosmetic fields through the existing member RLS; internal trigger strips other metadata.

The authenticated SECURITY DEFINER advisory for the new RPC is intentional: the function verifies the family owner before locking/updating profiles, uses an empty search path and qualified relations, rejects anonymous calls, and has rollback-tested non-owner denial. Direct access to the internal trigger is revoked. No other advisor notices are addressed by this cosmetic release.

## Validation

Production build and UTC Vitest suite pass. Regression checks cover paired PNG inventory, path validation, legacy compatibility, unchanged identity requirements and explicit dialog application. `supabase/tests/paired_sport_avatar_appearance.sql` uses a rollback-only transaction to check ownership, unlocks, persistence, sanitized group sync, unchanged rewards/history and legacy restoration. No test writes remain in athlete data.

Authenticated browser and physical Galaxy Fold checks remain outstanding. The other twelve sport pairs, Pack 16, Body Intelligence and later Locker work remain on the roadmap.

## Age and pose refinement — 9 October 2026

Gold through Unreal now use twelve reviewed v3 portraits with adult facial proportions and tier-specific poses. Bronze and Silver retain the junior/teen originals. The saved paired_v2 appearance, logical rewards, XP and unlock thresholds remain unchanged; no database migration is required. Original images and generation prompts are retained.
