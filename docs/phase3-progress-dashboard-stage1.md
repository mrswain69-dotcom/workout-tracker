# Phase 3 Progress Dashboard — Stage 1 Training Progress Engine

Status: complete on `feature/phase3-progress-dashboard`.

Stage 1 adds the pure Training Progress aggregation layer defined in Stage 0. It introduces no database schema, live data, UI navigation change, XP rule, badge rule or plan mutation.

## Objective

Stage 1 provides one tested source of truth for the Training side of the future Progress area:

- completed structured Sessions this week;
- completed structured Sessions this month;
- partial Session activity kept separate from completion;
- structured Session training time;
- recorded repetitions/executions;
- attempts, successes and accuracy where explicitly recorded;
- rolling four-week Session Balance;
- canonical Movement totals;
- profile isolation;
- deliberate empty-history output.

It intentionally does not add Assessment summaries, Development Trends or UI. Those are later Phase 3 stages.

## Architecture

New files:

- `src/engine/progressTrainingEngine.js`
- `src/engine/progressTrainingEngine.test.js`

The engine composes the existing Phase 1 Session engine rather than creating a second Session-history implementation.

Reused Session primitives include:

- `aggregateSessionHistory(...)`;
- `aggregateMovementHistory(...)`;
- `getSessionDistribution(...)`;
- `sessionHasActivity(...)`;
- `sessionIsCompleted(...)`.

The Progress layer adds only the dashboard-specific concerns that were not Session-engine responsibilities: consistent calendar windows, selected-profile scoping, unique Session-day counts, zero-filled active-template balance, historical-template preservation and typed Movement-total presentation.

## Public Stage 1 API

### `buildTrainingProgressWindows(selectedDate)`

Creates the canonical dashboard ranges from one reference date:

- `week`: Monday through Sunday;
- `month`: current calendar month;
- `recent28`: inclusive rolling 28 days ending on the reference date;
- `lifetime`: all genuine available structured Session history.

Date arithmetic uses `YYYY-MM-DD` UTC calendar operations so browser locale/timezone rendering cannot shift a dashboard boundary.

### `scopeProgressLogs(logs, profileId)`

When a profile is supplied, only rows explicitly belonging to that profile survive. Another athlete's Session history therefore cannot inflate the selected athlete's dashboard.

The normal application DB path already loads logs by profile; this extra engine guard makes the aggregation contract safe and independently testable.

### `countStructuredSessionDays(...)`

Counts unique calendar dates containing genuine structured Session activity.

It deliberately delegates activity/completion meaning to the Session engine. Multiple Sessions on the same day count as multiple Sessions but only one Session-training day.

### `buildTrainingWindowSummary(...)`

Returns a consistent summary for any supplied range:

- completed Sessions;
- partial Sessions;
- active Session days;
- completed Session days;
- total Session minutes;
- recorded executions;
- attempts;
- successes;
- accuracy percentage when attempts exist.

### `buildSessionBalance(...)`

Builds the rolling Session distribution required by the brief.

Rules:

- only completed structured Sessions increase a Session count;
- partial Sessions do not inflate balance;
- every current active Session Template appears even when its count is zero;
- active templates use their configured sort order;
- a completed historical Session whose live Template no longer exists remains visible as a historical-only row using its frozen snapshot identity.

The default combined Progress model uses the rolling 28-day range locked in Stage 0.

### `buildMovementTotals(...)`

Uses canonical Movement identity via the Phase 1 Movement-history aggregator.

For each performed Movement it retains separate fields for:

- times performed;
- recorded executions;
- attempts;
- successes;
- accuracy;
- best score;
- last performed date.

The view-model additionally exposes typed `measures` buckets for executions, attempts/successes and best score. These values are never added together as though repetitions, attempts and scores shared a physical unit.

`recordedExecutions` is intentionally the Session engine's count-like execution total: explicit repetitions/successful executions plus recorded successes from attempts/successes tracking. The raw attempt and success totals remain separately available, so the UI can label this as executions rather than falsely describing every value as repetitions.

The current live 17 Session Movement steps use:

- repetitions: 7;
- successful executions: 1;
- attempts + successes: 7;
- best score: 2.

Those current definitions are therefore fully represented by the Stage 1 output without introducing a football-specific calculation.

### `buildTrainingProgress(...)`

Produces the combined Training Progress model:

- profile ID;
- canonical windows;
- week summary;
- month summary;
- rolling 28-day summary;
- lifetime summary;
- rolling Session Balance;
- all-time canonical Movement totals;
- `hasStructuredSessionHistory` state for deliberate empty UI handling later.

## Truthful completion and duration rules

Stage 1 preserves the Session contracts established in Phase 1.

### Completion

A Session counts as completed only when its frozen Session snapshot is completed.

The engine does not count:

- planned/unperformed Sessions;
- a partial Session as completed;
- a legacy strength/cardio/task workout as Session A/B/C merely because the exercises are similar.

### Partial activity

A partial structured Session remains visible as activity and may contribute real recorded detail, but it is kept separate from completed-Session counts and Session Balance.

### Training time

Structured Session minutes use the Session engine's existing duration rules:

- use actual duration when captured;
- if a Session is completed and has no actual duration, the frozen planned duration may be used as the existing fallback;
- an incomplete Session does not receive invented planned minutes merely because it was planned.

### Recorded executions

Only explicit structured result data contributes execution totals.

A completion-only Movement may count as practised while contributing zero numeric executions. Stage 1 does not invent repetitions from duration, Session completion or instructions.

Attempts/successes remain available separately so accuracy information is not lost.

## Window behavior verified

For reference date `2026-09-10`:

- This week = `2026-09-07` through `2026-09-13`;
- This month = `2026-09-01` through `2026-09-30`;
- Last 4 weeks = `2026-08-14` through `2026-09-10` inclusive.

Automated tests prove Sessions immediately outside those boundaries are excluded from the relevant summary.

## Empty-history behavior

With no structured Session history:

- all completed/partial/minute/execution counters are zero;
- Movement totals are empty;
- `hasStructuredSessionHistory = false`;
- active Session A/B/C balance rows still exist with count zero.

This is the exact current production state and gives Stage 4 a purposeful empty-state model without creating fake history.

## Automated verification

Feature code head: `ebc0878a5003ba7e599770acc2cc740c2c55e12a`.

Permanent PR gate:

- Workout Tracker CI run #252 / ID `34448513127`: success;
- GitHub PR merge ref tested: `6d6307928c73d99f91ad1ef0e3fe2b919ab11998`;
- 30/30 test files passed;
- 322/322 tests passed;
- new `progressTrainingEngine`: 18/18 tests passed;
- existing `sessionEngine`: 16/16 tests passed;
- Vite 8.2.2 production build passed;
- 661 modules transformed;
- npm audit: 0 vulnerabilities;
- exact feature-head Vercel preview: success.

The 18 Stage 1 tests cover:

- Monday/Sunday week boundaries;
- calendar-month boundaries;
- inclusive rolling 28 days;
- profile isolation;
- empty history;
- legacy-workout non-reclassification;
- completed versus partial Sessions;
- duration fallback rules;
- unique Session days;
- explicit execution/accuracy totals;
- completion-only detail;
- zero-filled active Session Balance;
- historical Template identity;
- canonical Movement reuse across Sessions;
- typed execution/accuracy/best-score measures.

## Live production safety verification

No Stage 1 SQL write or production application deployment was performed.

After the Stage 1 branch gate, live Supabase still reports:

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

## Explicit Stage 1 boundaries

Stage 1 does not:

- alter `App.jsx` navigation or the existing Stats UI;
- create Progress cards/charts;
- load Assessment history;
- calculate Assessment PB summaries;
- calculate Development Trends;
- make training-to-test causal claims;
- create database tables/views;
- insert synthetic production data;
- alter Session definitions, plans, XP, streaks or badges.

Next: Stage 2 — build the pure Assessment Progress summary engine for latest benchmark, baseline state, genuine new PB events, biggest compatible improvements and unchanged/declining Tests.