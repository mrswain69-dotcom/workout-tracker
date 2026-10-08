# Rugby paired collection — 8 October 2026

All sixteen transparent v2 portraits are complete: Bronze, Silver, Gold, Platinum, Diamond, Elite, Champion and Unreal, each with male/female appearances. Bronze starts in practical junior kit without an award. Silver has a player-of-the-match honour; Gold a gold oval-ball honour; Platinum a club cup; Diamond a domestic championship cup; Elite an international cup; Champion all three cups. Unreal uses a navy suit and an original silver player-of-the-year honour. The pairs share equivalent kit quality and awards.

## Selection and compatibility

Rewards → Avatars → Sport Mastery now offers the existing male/female preview selector for Rugby. Previewing does not equip the artwork: open a claimed identity and choose **Use this avatar**. Existing equipped portraits keep their original appearance until an explicit selection. All eight original Rugby files remain available.

Both appearances share `sport_avatar_rugby_<tier>`, the existing 40/80/120/160/200/240/280/320-session ladder and unchanged XP rewards. Appearance switching adds no claim or XP and does not split selection history. Header, dashboard, identity dialogs and group displays reuse the existing validated appearance resolver. Historical group identity fallback remains intact.

## Database and validation

The additive `20261008223558_rugby_paired_avatar_appearance.sql` migration expands the existing RPC allowlist to Football and Rugby. It preserves owner authentication, claimed-reward checks, variant validation, an empty search path and sanitized appearance metadata. Only `edition` and `variant` reach the group directory. Anonymous RPC execution and authenticated access to the internal trigger remain revoked.

Rollback-only Rugby and Football SQL checks passed against the project database. Rugby checks compare full selection-period records and every saved plan field except appearance, covering history, XP and reward invariance as well as ownership, unclaimed avatars, invalid variants, unfinished Cricket rejection, persistence, group sync and legacy restoration. The transaction leaves no athlete data changes. The authenticated SECURITY DEFINER advisory remains intentional for this owner-checked RPC; no additional performance findings target it. Advisor reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable .

UTC tests and the production build validate complete paired PNG paths, legacy compatibility, unchanged identity requirements, explicit dialog application and group appearance resolution. All sixteen originals are 1254 × 1254 RGBA with transparent alpha; hashes, prompts and references are recorded in `rugby-production-record.json`. Artwork was visually reviewed individually. The existing selector wraps on narrow layouts and the dialog has its mobile layout; authenticated browser and physical Galaxy Fold checks remain outstanding.

Football and Rugby are complete. Cricket is next; eleven sports / 176 portraits remain. This release does not start another collection or the Pack 16, education or Locker stages.
