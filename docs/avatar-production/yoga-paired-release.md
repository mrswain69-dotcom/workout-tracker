# Yoga paired avatar release

Sixteen original transparent portraits complete both appearances across eight tiers. The same two fictional characters visibly mature from junior Bronze to adult Unreal, using varied introductory, recognition, walking, leadership, celebration and formal poses. Equal kit coverage, award scale and prestige apply to both appearances. Recognition objects express fictional practice milestones rather than competitive, teaching or medical qualifications.

All accepted images retain original generated PNG bytes. Prompts, references, dimensions, hashes and rejected-generation correction provenance are in yoga-production-record.json. Unreal male was regenerated using his own Bronze identity; Diamond male was corrected through imagegen to a solid gold sculpture. Existing completed artwork and legacy originals are preserved.

Both appearances share the existing logical unlock and claim. Session thresholds, XP and selection history remain unchanged. Migration 20261010131647_yoga_paired_avatar_appearance.sql enables Yoga with existing authenticated family-owner, claimed-reward, sanitisation and history protections; no public/anonymous execution grant.

Validated: sixteen 1254px square RGBA PNGs, alpha range 0–255 and original SHA-256 matches; complete 208-slot inventory; UTC suite 196 files / 1,191 tests; production build; diff checks; all thirteen rollback-only live avatar SQL regressions, including ownership, claim, variant, sanitised group sync and complete history/XP/reward invariance. Advisors retain the existing intentional owner-checked authenticated SECURITY DEFINER notice; no performance finding targets this RPC. Other existing findings are outside this release.

Workout Tracker CI (run 38055285253), including tests, build and dependency security audit, and Vercel preview passed at c9fdb3eb769a8e20bf43f515fe398b8afc6b10d5. PR #98 merged as 45e66c533e2dd30ecc6e42bf3e20f99c38a4d471. Production Vercel status succeeded; all sixteen Yoga hashes and all 208 active portrait hashes matched saved files, and the live client enables all thirteen sports. The production public page renders without app-origin console errors. No manual device or authenticated browser gallery QA was performed. See paired-avatar-production-verification.json.

Existing advisory reference: [authenticated SECURITY DEFINER execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). The owner-checked authenticated RPC intentionally retains this execution model.
