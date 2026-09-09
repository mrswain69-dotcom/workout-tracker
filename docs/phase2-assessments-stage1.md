# Phase 2 Assessments — Stage 1 Database Foundation & RLS

Status: COMPLETE / APPLIED / VERIFIED.

Stage 1 is an additive database-only foundation. It does not seed Assessment content, change profile plans, change Session definitions, or rewrite historical workout logs.

## Applied Supabase migrations

Project: `chdoyavyydwaewpuzbsb`

- `20260909172708_phase2_assessment_foundation`
- `20260909172745_phase2_assessment_grant_hardening`

## New generic tables

### Definition layer

1. `assessment_templates`
   - family-owned editable Assessment definitions
   - name/category/description
   - version/sort order/archive state

2. `tests`
   - canonical reusable Test definitions
   - metric type and unit
   - higher/lower scoring direction
   - attempt count
   - single/best/average retained-result strategy
   - side mode
   - negative-value allowance
   - PB eligibility
   - extensible metric configuration JSON
   - version/archive state

3. `assessment_template_tests`
   - ordered Test membership inside an Assessment Template
   - section label
   - display label/instructions/protocol
   - template-specific configuration override JSON

4. `test_development_tags`
   - reusable many-to-many Test ↔ existing `development_tags` bridge
   - no football-specific Movement/Test relationship added

### History layer

5. `assessment_runs`
   - one profile performing one Assessment Template on one date
   - in-progress/completed/cancelled status
   - source template/version
   - immutable template snapshot
   - notes/timestamps

6. `assessment_test_results`
   - one Test result within an Assessment run
   - source canonical Test and optional template-Test relationship
   - immutable Test/metric snapshots
   - raw result data
   - retained result data
   - scalar comparable value where meaningful
   - extensible comparable-dimensions JSON for left/right or other dimensional results
   - validity and notes

## History protection

Assessment runs and Test results do not expose DELETE through the authenticated API. Historical corrections will use controlled updates while PB/baseline state remains derived from retained history.

Definitions use soft archive. Ordered template membership and Test/Development-Tag relationships can be deleted/reordered as part of future authoring UI.

## RLS and Data API boundary

All six new public tables have RLS enabled.

Policy counts:

- `assessment_templates`: 3 — SELECT / INSERT / UPDATE
- `tests`: 3 — SELECT / INSERT / UPDATE
- `assessment_template_tests`: 4 — SELECT / INSERT / UPDATE / DELETE
- `test_development_tags`: 3 — SELECT / INSERT / DELETE
- `assessment_runs`: 3 — SELECT / INSERT / UPDATE
- `assessment_test_results`: 3 — SELECT / INSERT / UPDATE

All policies target `authenticated` explicitly and use family ownership through `families.owner_user_id = (select auth.uid())`.

Assessment run policies additionally require `profile_id` to belong to the same `family_id`, preventing cross-family athlete assignment through the authenticated API.

Anonymous table privileges were revoked on all six tables.

Authenticated privileges were hardened after Supabase default public-schema grants were observed:

- `assessment_templates`: INSERT / SELECT / UPDATE
- `tests`: INSERT / SELECT / UPDATE
- `assessment_template_tests`: DELETE / INSERT / SELECT / UPDATE
- `test_development_tags`: DELETE / INSERT / SELECT
- `assessment_runs`: INSERT / SELECT / UPDATE
- `assessment_test_results`: INSERT / SELECT / UPDATE

No authenticated TRUNCATE, REFERENCES or TRIGGER privilege remains on these tables.

## RLS smoke test

A temporary Assessment Template was inserted as the real family owner while running as the `authenticated` role, successfully read by that owner, and then rolled back.

A separate insert attempt using an unrelated authenticated identity was rejected with:

`new row violates row-level security policy for table "assessment_templates"`

No smoke-test rows remain.

## Referential integrity / indexing

Composite foreign keys preserve same-family relationships between Assessment definitions and history.

Stage 1 added covering indexes for family filters, template/Test relationships and history lookups. Post-migration Supabase performance advisors produced no new unindexed-FK warnings for any Assessment table and no new auth-RLS-initplan warnings for any Assessment table.

The new-table `unused_index` notices are expected at Stage 1 because all Assessment tables intentionally contain zero rows.

## Security advisor result

The only Supabase security advisor warning remains the pre-existing account-level `auth_leaked_password_protection` warning. No new Assessment/RLS security warning was reported.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Stage 0 fingerprint proof

Immediately before Stage 1 DDL:

- workout logs: 499
- workout-log hash: `91b10f9431340a9f82c7aaa179974972`
- Paul plan: `a715c519932be388cebe88722439de8b`
- Wilf plan: `278e036e425e2eeff7b02b417029403f`
- Xander plan: `b3b95dc0668da96dfcfeccdea21b6cfe`
- Session Library: 1 programme / 15 movements / 3 templates / 17 template movements / 6 development tags / 44 movement-tag links
- Assessment tables: none

After both migrations and RLS smoke testing:

- workout logs: 499
- workout-log hash: `91b10f9431340a9f82c7aaa179974972`
- Paul plan: `a715c519932be388cebe88722439de8b`
- Wilf plan: `278e036e425e2eeff7b02b417029403f`
- Xander plan: `b3b95dc0668da96dfcfeccdea21b6cfe`
- Session Library: 1 / 15 / 3 / 17 / 6 / 44 unchanged
- all six Assessment table row counts: 0
- all tested Assessment relationship orphan counts: 0

Therefore Stage 1 did not alter any Stage 0 workout-log, plan or Session-Library fingerprint.

## Stage 1 acceptance result

PASS.

The database is now ready for Phase 2 / Stage 2: the generic metric/result engine and automated tests. Stage 2 should not seed the Football Monthly Benchmark yet.
