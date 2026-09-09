# Phase 2 Assessments — Stage 5

## Status

Complete. Stage 5 adds the first athlete-facing Assessment execution and persistence path while keeping Assessment history separate from ordinary workout logs.

## Scope delivered

### Immutable run snapshots

`src/components/assessments/assessmentRunController.js` builds a frozen run definition when an Assessment starts. The snapshot records:

- Assessment Template id, name, category, description and version
- ordered Test positions
- Assessment Template/Test membership ids
- section/display labels
- instructions and protocol text
- per-template config overrides
- canonical Test id, name, description and version
- the resolved effective metric definition used for that run
- shared Development Tag ids present at run start

Subsequent edits, renames, reorders or archives in the editable Assessment Library do not refresh a historical run snapshot.

### Assessment history DB adapter

`src/assessmentRunDb.js` provides the Stage 5 history access layer for the existing Stage 1 tables:

- list/get/create/update `assessment_runs`
- list/create/update `assessment_test_results`

There is deliberately no delete API for Assessment history.

Run updates are restricted to mutable lifecycle fields (`status`, `completed_at`, `notes`). The adapter does not expose a path to rewrite the Template snapshot/version/profile/template identity after the run has started.

Test-result updates are restricted to raw/result/comparable/validity/notes fields. The historical Test identity, position, display snapshot and metric snapshot are not updateable through the Stage 5 adapter.

### Start, save, resume, complete and cancel lifecycle

Starting an Assessment:

1. validates the active editable definition
2. resolves the current effective Test metrics
3. writes the run with `status = in_progress` and its immutable Template snapshot
4. creates one placeholder `assessment_test_results` row per frozen Test with its frozen metric snapshot

The placeholder-first design means an interrupted Assessment is already a durable historical run and can be resumed.

If an in-progress run is found with a missing placeholder row after an interrupted start, Stage 5 can recreate the missing placeholder from the immutable snapshot. Completed/cancelled history is never auto-repaired by inserting new Test rows.

Saving progress writes current raw Test inputs, retained result, comparable values/dimensions, validity and notes while keeping the run in progress.

Completion first saves and validates every Test. The run is marked `completed` only when every frozen Test has a valid result. A partially invalid Assessment remains in progress.

Cancellation updates the run status to `cancelled`; it does not delete the run or Test-result rows.

### Metric entry UI

`AssessmentResultInput.jsx` uses the Stage 2 metric engine and supports:

- numeric/time/distance/repetition-style scalar attempts
- configured attempt counts
- single, best and average retained-result strategies
- higher/lower-is-better definitions
- signed values where explicitly allowed
- separate left/right dimensions
- attempts/successes pairs
- live retained-result formatting/validation

A Stage 5 regression tightened attempts/successes parsing so blank attempts or successes are incomplete rather than silently coercing an empty string to numeric zero. A genuinely entered zero remains valid.

### Athlete runner

`AssessmentRunner.jsx` displays the frozen run rather than the live editable definition. It includes:

- frozen Assessment/version/date/athlete identity
- sections
- Test display labels
- instructions and protocol text
- raw result entry
- optional per-Test notes
- optional overall Assessment notes
- valid-Test progress count
- Save progress
- Cancel Assessment
- Complete Assessment

Completion is disabled until all Test results are valid.

### Assessment Hub / app integration

`AssessmentHub.jsx`:

- scopes in-progress runs to the selected profile
- lists active Assessment Templates available to start
- resumes existing in-progress runs from their stored snapshots
- orchestrates start/save/complete/cancel persistence
- shows a deliberate empty pre-seed state before Stage 7

The main Workout Tracker navigation now includes a fifth tab labelled `Assess`. It uses the currently selected athlete and current local date. The mobile tab strip was changed from four to five equal columns with tighter button sizing so the tab row remains usable on small screens.

Assessment execution is an athlete logging action and is not parent-PIN gated. Definition editing remains parent-PIN protected through the Stage 4 Settings Library.

## History model

Stage 5 preserves the Stage 0/1 architecture:

- editable definitions live in Assessment Library tables
- run/Test historical facts live in `assessment_runs` / `assessment_test_results`
- history interpretation comes from immutable snapshots, not current editable definitions
- retained scalar results are stored as JSON objects (for example `{ "overall": 2.04 }`) to match the Stage 1 `jsonb` contract
- comparable scalar/dimension fields are stored for later Stage 6 history/PB calculations
- PB/baseline/previous-result claims are **not** stored by Stage 5; Stage 6 derives them from completed history

## Automated verification

Current clean-head gate after app integration:

- 25 / 25 test files passed
- 263 / 263 tests passed
- Vite 8.2.2 production build passed
- npm audit found 0 vulnerabilities
- Vercel preview succeeded

Stage 5-specific coverage includes:

- 13 Assessment run controller tests
- 7 Assessment run DB adapter tests
- 7 Assessment result input tests
- 8 Assessment runner tests
- 5 Assessment Hub integration tests
- 1 additional blank attempts/successes metric regression

Coverage verifies immutable snapshots, definition-change isolation, lower/higher retained results, L/R dimensions, partial progress, resume, placeholder repair, completion gating, cancellation-without-delete, DB field restrictions, profile scoping, pre-seed empty state and persistence error handling.

## Live Supabase verification

Stage 5 made no live Assessment content writes while being developed/verified.

Post-Stage-5 read-only checks show:

- Assessment Templates: 0
- canonical Tests: 0
- Assessment Template/Test memberships: 0
- Test/Development-Tag links: 0
- Assessment runs: 0
- Assessment Test results: 0
- historical workout logs: 499
- Paul plan hash: `a715c519932be388cebe88722439de8b`
- Wilf plan hash: `278e036e425e2eeff7b02b417029403f`
- Xander plan hash: `b3b95dc0668da96dfcfeccdea21b6cfe`
- Session Library counts remain `1 / 15 / 3 / 17 / 6 / 44`

The two Assessment history tables still have RLS enabled with three policies each. Their authenticated grants remain only `INSERT`, `SELECT`, `UPDATE`; no anonymous grants and no history delete privilege/path were introduced.

## Deliberately deferred

Stage 5 does **not** add:

- seeded Football Monthly Benchmark definitions — Stage 7
- historical PB / previous / baseline comparisons — Stage 6
- Assessment history visualisation — Stage 6
- recurring Wilf/Xander benchmark scheduling — Stage 8
- any Assessment-derived XP or badge changes
- workout-log rewrites
- plan mutations

## Next stage

Stage 6: Test history, PB, previous-result and baseline comparison engine/UI, derived from completed immutable Assessment history.
