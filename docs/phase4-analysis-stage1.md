# Phase 4 Analysis — Stage 1 Assessment Pair & Relevant Training Evidence

Status: implementation complete; final branch CI/Vercel verification pending at this documentation commit.

## Scope

Stage 1 establishes the historical relationship layer used by later Phase 4 analysis.

It does not generate recommendations or causal narratives. It determines which completed Assessments may be compared, which structured training sits strictly between them, and which Session Movements are genuinely related through Development Tags.

## Session snapshot hardening

`SESSION_SNAPSHOT_SCHEMA_VERSION` is now `2`.

Every newly created Movement inside a Session snapshot stores a sorted, deduplicated `developmentTagIds` array copied from the Session Library's Movement↔Development-Tag relationships.

This is forward-only hardening:

- existing workout logs are not rewritten;
- existing v1 Session snapshots remain readable;
- a v2 frozen empty tag array is authoritative and does not later inherit newly added live tags;
- a v2 frozen non-empty tag array remains historical evidence if the live taxonomy later removes those links;
- old/synthetic v1 Movement snapshots that do not have the property may use current taxonomy as an explicit fallback.

Assessment snapshots already froze Test Development Tag IDs, so Stage 1 gives both sides of the future training↔testing relationship an immutable path for newly recorded history.

## Assessment pair engine

New pure engine:

`src/engine/assessmentAnalysisEvidenceEngine.js`

`buildAssessmentAnalysisPair(...)`:

- uses completed Assessments only;
- scopes to the selected athlete;
- starts from the latest completed Assessment;
- pairs it only with the immediately previous completed run of the same Assessment Template;
- never substitutes an intervening/different Assessment Template;
- delegates Test comparison, PB, baseline and compatibility truth to the released `buildAssessmentProgress(...)` engine.

States:

- `no_baseline`
- `baseline_only`
- `analysis_ready`

## Strict between-Assessment interval

`buildAssessmentAnalysisInterval(previousDate, latestDate)` excludes both Assessment dates.

Example:

- previous Assessment: 1 September 2026
- latest Assessment: 1 October 2026
- analysed training interval: 2 September through 30 September

This is deliberate because workout history currently proves the workout calendar date, not whether an Assessment-day workout occurred before or after the benchmark.

## Development Tag provenance

Two provenance resolvers are included:

- `resolveAnalysisTestDevelopmentTags(...)`
- `resolveAnalysisMovementDevelopmentTags(...)`

They return both tag IDs and a source:

- `frozen`
- `current_taxonomy`
- `none`

Frozen snapshot data takes precedence. Current taxonomy is used only when the relevant historical snapshot property is absent.

## Relevant training evidence

`buildRelevantTrainingEvidence(...)` reads only structured Session blocks in the strict interval for the selected athlete.

Rules:

- legacy workout blocks are never reverse-mapped into Development Tags;
- a Session is related only when a Movement's tags intersect the Test's Development Tags;
- one completed relevant Session is counted once even when several related Movements occur inside it;
- partial relevant Sessions remain separate;
- Movement evidence retains per-Movement rows;
- explicit repetition/execution values are summed only as execution evidence;
- attempts/successes remain their own typed evidence and never inflate execution totals;
- attempts/successes accuracy is derived only from those typed counts;
- best scores remain separate observations and are not summed into volume;
- unlike measurement types are never combined.

The engine returns an evidence level:

- `high` — explicit execution/repetition or attempts/successes evidence;
- `medium` — related Movement genuinely performed but without compatible numeric volume;
- `low` — related structured snapshot present but performance evidence insufficient;
- `none` — no related structured evidence recorded.

`none` is not a claim that the athlete did no related training outside recorded structured Sessions.

## Combined Test evidence

`buildAssessmentTrainingEvidence(...)` combines the same-template Assessment pair with the existing Phase 3 latest Test statuses and attaches related between-Assessment training evidence to each Test.

It does not reinterpret Test direction or PB state. Those remain owned by the Assessment Progress engine.

## Regression findings

The first CI attempt was blocked by a syntax typo in the new test fixture before the new evidence tests could execute. Existing tests and the new Session snapshot tests that did execute were green.

After correcting the fixture, the next gate exposed a genuine semantic issue: the lower-level Session helper represents successes from an attempts/successes Movement as recorded executions. Using that value directly in Phase 4 would have double-represented `8/10 successful` as both eight executions and eight successes.

The Phase 4 evidence engine was corrected so `attempts_successes` contributes only to attempts/successes evidence, while repetition/execution tracking remains in the separate execution total. The test was retained unchanged because it correctly enforced the Phase 4 typed-evidence contract.

## Tests added

- `src/engine/sessionAnalysisSnapshot.test.js`
- `src/engine/assessmentAnalysisEvidenceEngine.test.js`

Coverage includes:

- Session snapshot schema v2 and immutable Movement tags;
- zero/one/two Assessment states;
- same-template pairing;
- athlete isolation;
- strict interval boundaries;
- frozen-vs-current Test and Movement tag provenance;
- frozen empty tag semantics;
- one-Session/multiple-related-Movement counting;
- execution vs attempts/successes separation;
- high/medium/low/none evidence;
- legacy workout exclusion;
- current-taxonomy fallback reporting;
- combined Assessment comparison + related training evidence.

## Temporary integration mechanics

A branch-only guarded patch workflow/script was used to update the existing Session engine and to apply a small semantic correction. The first Session-specific temporary files were removed after the snapshot patch. A generic `phase4-apply` branch-only patch runner remains temporarily available for later Phase 4 integrations and must be removed before the final Phase 4 release gate.

## Data safety

Stage 1 performs no database writes or schema changes and does not alter weekly plans, legacy workout history or Assessment history.

The protected Phase 4 Stage 0 production baseline remains the release invariant.
