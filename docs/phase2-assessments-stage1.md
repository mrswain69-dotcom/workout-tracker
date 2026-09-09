# Phase 2 Assessments — Stage 1 Database Foundation & RLS

Status: Stage 1 complete and verified.

Stage 1 added the generic Assessment database foundation only. No Assessment seed data, profile-plan changes, workout-log rewrites or football-specific schema were introduced.

## Applied live Supabase migrations

- `20260909172708_phase2_assessment_foundation`
- `20260909172745_phase2_assessment_grant_hardening`

## Tables created

### `assessment_templates`
Family-owned editable Assessment definitions with category, description, version, sort order and soft archive.

### `tests`
Canonical reusable Tests with metric type, unit, higher/lower scoring direction, configured attempt count, retained-result strategy, side mode, signed-value allowance, PB eligibility, metric configuration and soft archive.

### `assessment_template_tests`
Ordered membership of Tests within an Assessment Template, including section label, display label, instructions, protocol text and optional config override.

### `test_development_tags`
Many-to-many bridge between canonical Tests and the existing shared `development_tags` table.

### `assessment_runs`
Historical athlete Assessment occasions with family/profile/template/date/status/version and immutable template snapshot.

### `assessment_test_results`
Historical Test results with immutable metric/test snapshots, raw result data, retained result, scalar comparable value where meaningful, comparable dimensions, validity and notes.

## Data integrity

Composite family-aware foreign keys protect cross-family definition/history relationships.

Assessment run RLS additionally requires the referenced profile to belong to the same family.

Verification after migration:

- all FK/orphan checks: 0
- all six Assessment tables: 0 rows
- no Football Monthly Benchmark data seeded

## RLS and API privilege model

All six tables have RLS enabled.

Policies explicitly target `authenticated` and use `(select auth.uid())` through the family owner relationship.

Definitions:
- Assessment Templates: select/insert/update; soft archive instead of delete
- Tests: select/insert/update; soft archive instead of delete
- Template/Test membership: select/insert/update/delete
- Test/Development-Tag links: select/insert/delete

History:
- Assessment runs: select/insert/update; no delete policy
- Assessment Test results: select/insert/update; no delete policy

The grant-hardening migration:

- revokes all Assessment-table privileges from `anon`;
- removes default broad authenticated privileges such as TRUNCATE/REFERENCES/TRIGGER;
- grants only the operations supported by the intended API surface.

## RLS smoke test

A temporary transaction was used to exercise RLS without retaining data.

- family owner authenticated identity: temporary Assessment Template insert/read succeeded;
- unrelated authenticated identity: insert into that family was rejected by RLS;
- transaction rolled back;
- final Assessment row counts remained zero.

## Supabase advisors

Security advisor after Stage 1:

- no Assessment-table/RLS security warning;
- only the pre-existing project-level `auth_leaked_password_protection` warning remains.

Performance advisor after Stage 1:

- no new Assessment unindexed-foreign-key warning;
- no new Assessment `auth_rls_initplan` warning;
- new Assessment indexes appear as unused, which is expected while every new table deliberately contains zero rows.

## Stage 0 fingerprint proof

Immediately before Stage 1 DDL:

- workout logs: 499
- workout-log hash: `91b10f9431340a9f82c7aaa179974972`
- Paul plan: `a715c519932be388cebe88722439de8b`
- Wilf plan: `278e036e425e2eeff7b02b417029403f`
- Xander plan: `b3b95dc0668da96dfcfeccdea21b6cfe`
- Session Library: 1 / 15 / 3 / 17 / 6 / 44

After both migrations, RLS smoke testing and grant hardening, the fingerprints were exactly unchanged:

- workout logs: 499
- workout-log hash: `91b10f9431340a9f82c7aaa179974972`
- Paul plan: `a715c519932be388cebe88722439de8b`
- Wilf plan: `278e036e425e2eeff7b02b417029403f`
- Xander plan: `b3b95dc0668da96dfcfeccdea21b6cfe`
- Session Library: 1 / 15 / 3 / 17 / 6 / 44

Stage 1 therefore met the additive/non-destructive acceptance guard.

## Next stage

Stage 2 — generic Assessment metric/result engine with automated tests — is now complete and documented in `docs/phase2-assessments-stage2.md`.

Next implementation stage: Stage 3 — Assessment DB access/library controller.