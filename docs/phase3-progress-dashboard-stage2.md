# Phase 3 Progress Dashboard — Stage 2 Assessment Progress Summary Engine

Status: complete on `feature/phase3-progress-dashboard`.

Stage 2 adds the pure Assessment Progress summary layer defined in Stage 0. It introduces no database schema, live Assessment history, UI navigation change, XP rule, badge rule, Session-plan mutation or production seed data.

## Objective

Stage 2 provides one tested source of truth for the Assessment side of the future Progress area:

- latest completed Assessment;
- explicit baseline state;
- genuine new PB events in the latest completed Assessment;
- latest-vs-previous Test classification;
- biggest safely comparable improvements;
- improved, declining, unchanged, mixed and unavailable Test groups;
- retained full Test/run history for later charts;
- profile and optional Assessment-Template scoping.

It composes the existing Phase 2 Assessment history/metric engines instead of duplicating PB or comparison logic.

## Architecture

New files:

- `src/engine/progressAssessmentEngine.js`
- `src/engine/progressAssessmentEngine.test.js`

Reused Phase 2 primitives include:

- `buildAssessmentRunHistory(...)`;
- `buildAssessmentTestHistory(...)`;
- immutable Test metric snapshots;
- compatible-metric comparison keys;
- higher/lower-is-better comparison semantics;
- percentage-improvement safety;
- independent left/right PB history.

The Stage 2 engine is read-only and pure. The DB loader remains responsible for fetching completed profile-scoped history, while this engine adds a second defensive profile/template scope so synthetic or accidentally mixed inputs cannot inflate another athlete's dashboard.

## Public Stage 2 API

### `scopeAssessmentProgressHistory(...)`

Filters the supplied Assessment runs to:

- one selected profile when `profileId` is supplied;
- one Assessment Template when `assessmentTemplateId` is supplied.

Only result rows belonging to retained runs survive.

### `buildAssessmentProgress(...)`

Returns the combined Assessment Progress model:

- `completedAssessmentCount`;
- `baselineState`;
- `hasBaseline`;
- `hasComparison`;
- `latestAssessment` metadata;
- `latestPbCount`;
- `latestPbTestCount`;
- `latestPbEvents`;
- `latestTestStatuses`;
- improved / declining / unchanged / mixed / unavailable Test groups;
- percentage-safe `biggestImprovements`;
- `absoluteOnlyImprovements` for genuine improvements that cannot be safely ranked across unlike units;
- complete Test history and completed-run history for later Phase 3 charts.

## Baseline-state contract

Stage 2 implements the Stage 0 early-data matrix explicitly:

### 0 completed Assessments

- `baselineState = no_baseline`;
- no latest Assessment;
- no PB count;
- no improvement/decline claims.

### 1 completed Assessment

- `baselineState = baseline_established`;
- the real completed Assessment becomes the athlete's original baseline;
- every latest Test comparison remains unavailable because no previous compatible result exists;
- PB event count is zero.

The first benchmark is therefore never presented as "20 new PBs".

### 2+ completed Assessments

- `baselineState = comparison_available`;
- latest-vs-previous compatible Test comparisons become available;
- genuine new-PB events may be counted;
- improvement/decline/unchanged/mixed summaries become meaningful.

Three or more results are retained for Stage 3/6 trend views, but Stage 2 itself remains a latest-run summary engine.

## Latest Assessment truth rule

The summary is anchored to the newest completed Assessment run.

Only valid Test rows actually present in that latest completed run receive latest-run status/PB classification. A canonical Test that exists historically but is absent from a later Assessment definition remains in full history for charts, but is not falsely classified as improved/declined in the latest Assessment.

In-progress and cancelled runs never affect baseline, PB or latest-completed summaries.

Invalid Test results are excluded from derived comparisons and PB events.

## Genuine new PB contract

PBs remain derived, never stored as permanent claims.

A latest result counts as a new PB event only when the Phase 2 history engine proves it strictly beats a prior compatible PB candidate.

Rules:

- first baseline result: no PB event;
- tied PB: no new PB event;
- PB-ineligible Test: no PB event;
- incompatible metric history: no PB mixing;
- scalar Test new PB: one event;
- bilateral Test: left and right are independent PB events.

Stage 2 returns both:

- `latestPbCount`: number of actual PB events/dimensions;
- `latestPbTestCount`: number of canonical Tests containing at least one new PB.

Example: if calf raises improve to a new PB on both left and right, that is 2 PB events across 1 canonical Test.

## Test status contract

The latest-vs-previous compatible dimensions use the Phase 2 comparison statuses.

Scalar Test statuses are straightforward:

- improved;
- declined;
- same;
- unavailable.

For bilateral Tests, Stage 2 adds a truthful Test-level `mixed` state.

Examples:

- left improved + right improved → improved;
- left declined + right declined → declined;
- both equal → same;
- left improved + right declined → mixed.

A mixed bilateral result is not silently placed in either the improved or declining bucket.

## Biggest-improvement ranking contract

The dashboard brief asks for biggest improvements, but raw physical-unit changes cannot safely be ranked across unlike Tests.

Stage 2 therefore uses the metric engine's safe percentage improvement only when available.

Examples:

- press-ups 10 → 12 = +20% and can be ranked;
- 10 m acceleration 2.00 s → 1.90 s = +5% performance improvement and can be ranked;
- signed toe-touch -4 cm → +2 cm is a genuine improvement, but percentage improvement is deliberately unavailable, so it must not be ranked against reps or seconds.

Outputs:

- `biggestImprovements`: improved Tests with a safe finite percentage, sorted highest first;
- `absoluteOnlyImprovements`: improved Tests with no safe cross-unit percentage.

This prevents the Progress UI from suggesting that +6 cm flexibility is inherently "more improvement" than +2 repetitions or -0.1 seconds.

## Metric compatibility

Stage 2 inherits the Phase 2 immutable metric-compatibility rules.

If a Test's retained meaning changes incompatibly — for example seconds to milliseconds without a compatible definition, higher/lower direction changes, side semantics change or fixed-trial raw-success protocol changes — the historical rows remain visible but latest-vs-previous comparison is `unavailable` with the metric-change reason.

No improvement/decline or new-PB claim crosses that incompatible boundary.

## CI-discovered null-percentage bug

The first Stage 2 PR gate failed one new synthetic test.

The underlying Phase 2 comparison correctly returned `percentageImprovement = null` for signed toe-touch, but the new Stage 2 ranking helper initially called `Number(null)`, which JavaScript converts to `0`. That incorrectly made a percentage-unsafe result appear rankable at 0%.

The engine boundary was corrected so only explicitly present, finite percentage values enter cross-Test ranking. The signed/zero-crossing regression test now protects that rule permanently.

No existing Phase 1/2 or Stage 1 test failed in that guarded run, and build/audit were correctly skipped after the test failure.

## Automated verification

Corrected feature code head: `15b862d194ee755addd92ebd8b3a0736614f7b29`.

Permanent PR gate:

- Workout Tracker CI run #258 / ID `34449522331`: success;
- GitHub PR merge ref tested: `9c432ea0061718ed90a7ef959a225d09abb19dd1`;
- 31/31 test files passed;
- 339/339 tests passed;
- new `progressAssessmentEngine`: 17/17 tests passed;
- existing `assessmentHistoryEngine`: 15/15 tests passed;
- existing `assessmentMetricEngine`: 38/38 tests passed;
- Vite 8.2.2 production build passed;
- 661 modules transformed;
- npm audit: 0 vulnerabilities;
- exact feature-head Vercel preview: success.

The 17 Stage 2 tests cover:

- profile scoping;
- Assessment-Template scoping;
- no-history state;
- first-run baseline behavior;
- in-progress/cancelled exclusion;
- higher-is-better improvement;
- lower-is-better improvement;
- tied PB behavior;
- decline behavior;
- independent bilateral PB events;
- mixed left/right status;
- two PB dimensions from one canonical Test;
- safe percentage ranking across unlike units;
- signed/percentage-unsafe improvements;
- incompatible metric changes;
- invalid latest results;
- Tests absent from the latest Assessment;
- retained three-point/full history for later charts.

## Live production safety verification

No Stage 2 SQL write or production application deployment was performed.

After the corrected Stage 2 branch gate, live Supabase still reports:

- workout logs: 499;
- structured Session blocks: 0;
- completed structured Sessions: 0;
- Assessment runs: 0;
- Assessment Test results: 0;
- active Assessment schedules: 2;
- Programmes: 1;
- Movements: 15;
- Session Templates: 3;
- Session Template Movements: 17.

Protected profile-plan fingerprints remain exactly:

- Paul: `a715c519932be388cebe88722439de8b`;
- Wilf: `278e036e425e2eeff7b02b417029403f`;
- Xander: `b3b95dc0668da96dfcfeccdea21b6cfe`.

## Explicit Stage 2 boundaries

Stage 2 does not:

- change `App.jsx` or navigation;
- create Progress cards/charts;
- create Development Tag trends;
- insert fake Wilf/Xander Assessment history;
- alter Assessment definitions or schedules;
- create database tables/views;
- award XP/badges;
- make training-to-test causal claims;
- recommend the next training focus.

Next: Stage 3 — build the Development Trend engine over shared Development Tags, using normalized per-Test direction/change while protecting incompatible physical units and preserving the Phase 4 analysis boundary.
