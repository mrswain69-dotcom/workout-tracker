# Phase 3 Progress Dashboard — Stage 5

## Status

Complete.

Stage 5 turns the Stage 4 Progress shell's Training area into a useful, truthful training dashboard while preserving all Phase 3 data contracts and the legacy Stats parity bridge.

## Scope delivered

### Training cards

The Progress Training area now surfaces:

- completed Sessions this week
- completed Sessions this month
- completed Sessions across the rolling last 4 weeks
- partial Sessions across the same rolling window, kept separate from completed Sessions
- active structured-Session days across the rolling last 4 weeks
- current streak
- current XP
- structured training time across the rolling last 4 weeks
- explicit recorded executions across the rolling last 4 weeks
- attempts/successes success rate across the rolling last 4 weeks when that typed measure exists

No completion-only Movement is given invented execution volume.

### Rolling training charts

`progressTrainingEngine` now exposes `buildTrainingTrendSeries`.

The locked rolling 28-day window is divided into four consecutive 7-day periods. For example, with reference date 2026-09-10:

1. 2026-08-14 → 2026-08-20
2. 2026-08-21 → 2026-08-27
3. 2026-08-28 → 2026-09-03
4. 2026-09-04 → 2026-09-10

This is deliberately not replaced with four calendar weeks. The four chart buckets therefore reconcile exactly with the existing Stage 0/1 `recent28` contract and never invent future days.

Two restrained charts are shown when genuine structured Session activity exists:

- Completed Sessions by 7-day period
- Training time by 7-day period

Training time retains the Stage 1 truth contract:

- actual duration where captured
- completed Sessions may use their frozen planned-duration fallback
- incomplete Sessions do not receive invented planned time

When there is no structured Session activity, Progress shows an explicit chart empty state rather than a misleading flat-zero performance graph.

### Session Distribution

The former Stage 4 Session Balance placeholder is now a real Session Distribution view.

Rules:

- rolling last 4 weeks only
- completed structured Sessions only
- partial Sessions do not inflate the distribution
- active Session definitions remain visible at zero
- historical completed Session templates remain visible if their live definition has since disappeared
- legacy workout blocks are never reclassified as Session A/B/C
- each Session row shows count and percentage share of completed structured Sessions

Zero-history production therefore correctly shows the active A/B/C definitions at zero without implying activity that never happened.

### Movement totals

A new Movement totals section uses Stage 1 canonical Movement aggregation across lifetime structured Session history.

Rows are ordered by number of genuine performances, then Movement name.

The UI preserves typed measurement semantics:

- repetitions / explicit executions remain execution counts
- attempts and successes remain attempts/successes, including accuracy percentage where available
- best-score tracking remains a best score
- completion-only Movement history remains visible without inventing a numeric total

Unlike measures are never summed into a single Movement score or compared as if repetitions, attempts and best scores shared a unit.

## View-model changes

`progressViewModel` now adds:

- formatted rolling 7-day chart ranges
- four-period training trend rows
- last-28-day completed/partial Session counts
- last-28-day active Session days
- last-28-day attempts, successes and accuracy
- `hasTrendActivity`
- Session Distribution total and per-Session percentage share
- Movement rows with formatted last-performed dates
- Movement ordering by practice frequency

The UI remains a consumer of pure engine/view-model output; Stage 5 does not move aggregation logic into `App.jsx`.

## Empty / early-data behavior

### 0 structured Sessions

- Training cards show truthful zero values
- chart area explains that charts begin after structured Session activity
- Session Distribution retains active definitions at zero
- Movement totals explicitly state that no structured Movement totals exist yet
- legacy Stats remains available below

### Partial-only history

- partial Session state remains distinct
- actual recorded partial time/activity can contribute where the Stage 1 engine permits it
- partial Sessions do not count as completed Session distribution

### 1+ completed Sessions

- charts become active
- distribution is based only on genuine completed Sessions
- Movement totals appear only for Movements genuinely performed

## Safety boundaries preserved

Stage 5 does not:

- write to Supabase
- backfill Wilf or Xander history
- rewrite legacy workout logs
- mutate `profiles.plan_json`
- classify old workout blocks as structured Sessions
- introduce a second Development Tag system
- add Assessment charts or detailed Development Trend rows (Stage 6)
- introduce Phase 4 causal analysis or recommendations
- remove the legacy Stats parity bridge

## Verification

### First gate

CI run #294 / ID `34454420245` failed in the new rendered Stage 5 UI test.

The failure was a test-fixture contract error, not a product defect: the fixture supplied left/right attempts/successes without the production snapshot's `trackingConfig.sideMode = "separate"`. The Session engine correctly refused to infer side semantics that were not declared.

The fixture was corrected to match the real immutable Session snapshot contract. No engine relaxation was made.

### Corrected code gate

Corrected Stage 5 code head:

`d1721b726504d5e1202eceabffd5520e7ae87fa6`

Permanent CI run #295 / ID `34454553666`:

- 38/38 test files passed
- 383/383 tests passed
- Vite 8.2.2 production build passed
- 667 modules transformed
- npm audit found 0 vulnerabilities
- exact-head Vercel preview status: success

Stage 5 added 10 tests:

- 4 rolling trend-engine tests
- 5 Stage 5 view-model tests
- 1 rendered ProgressDashboard Stage 5 test

The rendered UI test explicitly covers:

- both training chart surfaces
- Session Distribution
- repetition/execution Movement output
- left/right attempts/successes and accuracy
- best-score Movement output
- percentage Session distribution

### Live Supabase read-only verification

After Stage 5 code completion:

- workout logs: 499
- structured Session logs: 0
- Assessment runs: 0
- Assessment Test results: 0
- active recurring Assessment schedules: 2
- active Development Tags: 10
- Test/Development-Tag links: 48
- Paul plan fingerprint: `a715c519932be388cebe88722439de8b`
- Wilf plan fingerprint: `278e036e425e2eeff7b02b417029403f`
- Xander plan fingerprint: `b3b95dc0668da96dfcfeccdea21b6cfe`

All protected live-data invariants remain unchanged.

## Next stage

Phase 3 / Stage 6:

- Assessment result cards/charts
- detailed Test history presentation
- Development Trend rows and directional UI
- continued strict 0/1/2/3+ Assessment behavior
- no training-to-Assessment causal claims
