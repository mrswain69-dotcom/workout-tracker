# Phase 2 Assessments — Stage 6 History, PB & Baseline Progress

Status: complete on `feature/phase2-assessments`. Stage 6 is a derived/read-only history layer; it made no Supabase schema change, live Assessment seed, profile-plan change, workout-log rewrite or Session-Library mutation.

## Objective

Turn the immutable Assessment history established in Stage 5 into athlete-facing measured progress without storing irreversible PB or improvement claims.

For each canonical Test/profile, Stage 6 derives from completed valid history:

- latest result
- previous result
- original baseline
- all-time personal best (PB)
- change from previous
- change from baseline
- full chronological Test history
- compact result trend
- completed Assessment history

Separate left/right Tests retain independent side-specific comparisons and PBs.

## Derived-history principle

PBs, baseline and improvement are not stored as permanent flags.

They are recalculated from the retained Assessment history each time it is loaded. If historical result data is legitimately corrected later, the derived PB/baseline/comparison state therefore changes with that history rather than preserving an obsolete achievement claim.

Only completed Assessment runs and valid Test results participate in the progress engine. In-progress and cancelled runs remain historical lifecycle records but do not affect measured progress.

## `assessmentHistoryEngine.js`

The new pure engine groups historical results by canonical `test_id` and derives one Test history summary per athlete.

It provides:

- canonical Test grouping across Assessment runs
- chronological sorting
- earliest valid result as original baseline
- immediately preceding valid result as previous result
- latest valid result
- direction-aware higher/lower-is-better comparison
- strict all-time PB selection
- strict new-PB detection (ties are not a new PB)
- PB-at-the-time markers through the compatible historical sequence
- independent left/right PBs
- Stage 2 percentage-improvement safety rules
- completed Assessment history ordered newest-first
- historical snapshot-name preservation after later Test renames

The first valid result establishes a baseline but is not presented as a newly broken PB.

## Metric compatibility guard

Historical entries remain visible even when a Test definition changes, but Stage 6 does not automatically mix measurements whose frozen meanings are incompatible.

The comparison cohort requires the same:

- metric type
- unit
- scoring direction
- side mode
- attempts/successes comparison mode

Changing attempt count or retained-result strategy alone does not break comparability when the retained measurement still has the same meaning.

When the frozen metric contract changes:

- the full canonical Test history is still shown;
- the UI explicitly warns that the metric changed;
- misleading previous/baseline comparison is withheld across the boundary;
- current PB calculation uses the compatible metric cohort;
- trend graphs use only that compatible cohort, preventing different units from being plotted on one line.

This preserves historical truth without manufacturing mathematically neat but semantically false improvement.

## Assessment history data loading

`src/assessmentRunDb.js` now includes `loadCompletedAssessmentHistory(familyId, profileId)`.

The loader:

- explicitly filters by family and profile in addition to RLS;
- requests only `completed` runs;
- reads result rows only for the returned run IDs;
- batches run IDs in bounded chunks rather than issuing one result request per run;
- uses bounded query limits;
- introduces no new write path or delete path.

## `AssessmentHistory.jsx`

The new athlete-facing Progress experience contains two views.

### Test progress

Each canonical Test card shows:

- Latest
- Previous
- Original baseline
- Personal best
- Vs previous
- Vs baseline
- higher/lower-is-better context
- new-PB indicator when the latest result strictly beats the prior best
- compact chronological trend
- expandable full Test history
- baseline and historical PB-at-the-time markers
- historical name used by each frozen result when the Test has subsequently been renamed

Left/right Tests show independent side values, side-specific change and side-specific PB dates.

### Completed Assessments

The second view shows the underlying completed runs using their frozen historical snapshots:

- Assessment name
- date
- Template version
- Assessment notes
- ordered valid Test names/results

This makes the progress summary traceable back to the historical benchmark records from which it was derived.

## Assess integration

The existing Stage 5 `Assess` area now has two internal modes:

- `Run`
- `Progress`

`Run` preserves Stage 5 start/resume/logger behaviour.

`Progress` loads the selected athlete's completed history. Switching the active Workout Tracker profile therefore switches the history query to that athlete.

After a successful Assessment completion, the Hub switches to Progress so the new result can immediately be viewed in its derived historical context.

## Stage 6 verification

Clean integrated code head before this documentation commit:

- `bfcce16d8f96f0bd2c1d09b7d075b69508c1a69d`
- PR merge ref tested by CI: `a1b9f64974a1cfd5cd176f42ecd6c6ee50ff4d89`
- Workout Tracker CI run #211 / run ID `34396449281`
- 27/27 test files passed
- 286/286 tests passed
- Vite 8.2.2 production build passed
- 659 modules transformed
- npm audit: 0 vulnerabilities
- Vercel preview: success

Stage 6-specific coverage includes:

- 14 history-engine tests
- 10 Assessment history DB-adapter tests (expanded from Stage 5)
- 5 AssessmentHistory UI tests
- 6 AssessmentHub tests including profile-scoped Progress integration

The early Stage 6 gates exposed only test-expectation issues around intentionally duplicated summary text (for example when a two-result history makes previous and baseline the same historical result). Those assertions were corrected; no legacy Stage 0–5 regression failed in the final gate.

## Live Supabase safety verification

After the final Stage 6 code gate:

- Assessment Templates: 0
- canonical Tests: 0
- Assessment Template/Test memberships: 0
- Test/Development-Tag links: 0
- Assessment runs: 0
- Assessment Test results: 0
- workout logs: 499

Protected profile plan fingerprints remain exactly:

- Paul: `a715c519932be388cebe88722439de8b`
- Wilf: `278e036e425e2eeff7b02b417029403f`
- Xander: `b3b95dc0668da96dfcfeccdea21b6cfe`

Session Library remains:

- 1 programme
- 15 movements
- 3 Session Templates
- 17 Session Template Movements
- 6 Development Tags
- 44 Movement/Development-Tag links

`assessment_runs` and `assessment_test_results` still have RLS enabled with three policies each.

For the client application role, both history tables remain `INSERT, SELECT, UPDATE` only. No anonymous grant or Stage 6 delete route was introduced.

## Explicit Stage 6 boundaries

Stage 6 does not:

- seed the Football Monthly Benchmark;
- manufacture demonstration history;
- alter Assessment definitions;
- change the database schema;
- change weekly plans;
- change workout logs;
- award XP or badges from Assessment results;
- implement Phase 3 dashboard/AI analysis;
- make causal claims about why a Test result improved.

With the generic history/PB/baseline machinery verified, the next stage can seed and verify the shared Football Monthly Benchmark against this stable definition → runner → immutable history → derived progress pipeline.
