# Historical Timeline / Performance Autobiography — Stage 7 Production Release

Status: Final release candidate on `feature/historical-performance-autobiography`.

## Objective

Stage 7 is the production release gate for the Historical Timeline / Performance Autobiography.

It adds no new product behaviour. Its purpose is to prove that the complete Stage 0–6 implementation is aligned across repository source, GitHub CI, Vercel, Supabase migration state, Supabase Edge Function state, production security boundaries and protected historical data before merge to `main`.

## Completed phase contract

The release now contains the complete Historical Timeline foundation:

- Stage 0 — truth architecture and protected production baseline;
- Stage 1 — private nullable `birth_date` and true age calculation;
- Stage 2 — deterministic historical event engine;
- Stage 3 — birthday-to-birthday Age chapters and compatible trend evidence;
- Stage 4 — Consistency/award milestones and three-year Career Summary foundation;
- Stage 5 — visible Performance Autobiography inside Progress;
- Stage 6 — correction/deletion, ordering, age-edge, format-coexistence, privacy and mobile hardening;
- Stage 7 — final production/release verification.

The feature remains a derived historical view rather than a second scoring or persistence system.

## Production schema verification

Production migration history contains:

`20260912163033_historical_timeline_stage1_birth_date`

The migration is additive only:

```sql
alter table public.profiles
  add column if not exists birth_date date;
```

It has no default, backfill, insert, update or delete statement.

No workout, Assessment, Group, XP, Consistency or Plan history is rewritten by the Historical Timeline schema change.

## Production Edge Function verification

The production function:

`historical-timeline-data`

is ACTIVE as version 2 and was redeployed from the exact current release-branch source before closure.

`verify_jwt` remains enabled.

The function contract remains:

1. require an authenticated JWT;
2. validate the authenticated user;
3. prove that the exact requested profile can be selected through ordinary profile RLS;
4. only after that proof read that profile's server-only Consistency snapshots;
5. resolve only Group memberships belonging to the owned profile and owned family;
6. read frozen awards only for those resolved membership IDs;
7. return only the owned athlete's private Timeline payload;
8. perform no writes.

The browser continues to use the Edge Function rather than directly selecting from server-only historical authority tables.

## Production security review

Supabase security advisors were checked during Stage 7.

No advisory identifies a new Historical Timeline authorization defect.

`profile_consistency_schedule_snapshots` is reported as `RLS enabled, no policy`. That is intentional for this architecture: it has no client-facing Timeline policy, and the authenticated Timeline service reads it only after exact-profile ownership has been established through the ordinary `profiles` RLS boundary.

Other current advisor warnings concern existing Group `SECURITY DEFINER` RPC exposure and the account-level leaked-password-protection setting. They are not created by the Historical Timeline migration or Timeline Edge Function and are not silently treated as fixed by this release.

The Stage 7 source contract additionally locks:

- authentication before privileged historical reads;
- exact profile selection through profile RLS;
- family scoping of Group memberships;
- membership scoping of frozen awards;
- no privileged `profiles` read through the admin client;
- no Timeline service writes;
- no `birth_date` exposure in Group Edge Functions or Group UI.

## Production historical invariants

After the exact release-source Edge Function deployment, the protected production baseline remains:

- workout logs: **499**;
- Consistency schedule snapshots: **5**;
- completed Assessments: **0**;
- frozen Group progress awards: **0**;
- populated profile birth dates: **0**.

The feature therefore ships without rewriting or fabricating existing history and without guessing anybody's date of birth.

## Branch / merge audit

Immediately before the Stage 7 release contract was introduced, the feature branch was:

- ahead of `main` with no commits behind;
- based on the same merge base as the current `main` branch;
- scoped to Historical Timeline architecture, engines, tests, UI, DB adapters, one additive migration, one authenticated Edge Function and the Progress integration point.

No unrelated production feature rewrite is part of this release.

## Final release sentinel

`src/engine/historicalTimelineStage7ReleaseIntegration.test.js` permanently guards the release boundary.

It proves:

- the migration remains additive and backfill-free;
- authentication and exact-profile ownership proof precede privileged historical reads;
- the browser cannot bypass the Timeline service to read server-only authority tables;
- `birth_date` remains absent from Group functions and Group UI;
- the autobiography stays within Progress rather than adding another primary navigation destination;
- Career Summary integrity remains three-year gated and lifetime improvement remains metric-specific;
- the complete Stage 0–6 architecture record and Stage 6 hardening suite remain present.

## Verified Stage 7 candidate

The Stage 7 release-sentinel candidate `7d1fddabaf6092e4ae88fef32c8ced97a6d1583b` passed:

- **102 / 102** test files;
- **704 / 704** tests;
- the six-test Stage 7 release contract;
- the six-test Stage 6 hardening contract;
- production Vite build with **717 modules transformed**;
- `npm audit --audit-level=low` with **0 vulnerabilities**;
- exact-SHA Vercel deployment.

The production build also emits Vite's non-blocking bundle-size advisory because the main minified application chunk is approximately 500 kB. This does not fail the build or the release gate and is recorded as future code-splitting/performance technical debt rather than concealed.

## Final exact-head rule

This Stage 7 document changes the branch head after the verified candidate above.

Therefore the Historical Timeline phase is not considered released merely because `7d1fddab...` passed.

The exact commit containing this release record must itself pass:

- full GitHub CI;
- full test suite;
- production build;
- security audit;
- exact-head Vercel deployment.

Only then may PR #12 be taken out of draft and merged to `main`.

## Post-merge release gate

After merge, release closure requires:

1. confirm `main` contains the merged Historical Timeline release;
2. confirm the production Vercel deployment for the merged `main` revision succeeds;
3. recheck the protected production historical invariants;
4. confirm the production Timeline Edge Function remains ACTIVE with JWT verification enabled;
5. confirm no unexpected production data mutation occurred.

Only after those checks is Stage 7 and the full Historical Timeline / Performance Autobiography phase complete.
