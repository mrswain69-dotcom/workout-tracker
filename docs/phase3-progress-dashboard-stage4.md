# Phase 3 Progress Dashboard — Stage 4 Progress UI Shell

Status: complete on `feature/phase3-progress-dashboard`.

Stage 4 introduces the first real Progress user interface while preserving the existing Stats implementation underneath it as a guarded parity fallback. It wires the pure Phase 3 Training, Assessment and Development Trend engines into a dedicated Progress view-model and UI shell, implements the locked 0/1/2/3+ early-history states, and evolves the visible `Stats` navigation destination into `Progress` without creating a sixth main route.

No database schema, workout history, Assessment history, XP rule, badge rule, weekly plan or recurring schedule is changed by Stage 4.

## Objective

Stage 4 establishes the application shell that later Phase 3 UI stages can progressively fill with detailed charts and Movement/Test views.

The shell must immediately answer:

- is structured Training history available yet?;
- is an Assessment baseline available yet?;
- are Development comparisons/trends available yet?;
- how many Sessions were completed this week/month?;
- what is the current workout streak and XP?;
- how much structured Session time/execution data exists in the rolling four-week window?;
- what does current Session balance look like?;
- when is the next recurring benchmark?;
- what benchmark history is genuinely available?;
- are Development Tags at no-baseline, baseline, comparison or trend-ready state?

The UI must remain useful in the real current production condition where structured Session and Assessment history are both empty.

## New Stage 4 files

- `src/engine/progressViewModel.js`
- `src/engine/progressViewModel.test.js`
- `src/components/progress/ProgressDashboard.jsx`
- `src/components/progress/ProgressDashboard.css`
- `src/components/progress/ProgressDashboard.test.jsx`
- `src/components/progress/progressAppIntegration.test.js`

`src/App.jsx` receives only the guarded integration required to expose the shell.

## Progress view-model

`progressViewModel.js` is a pure presentation layer above the Stage 1–3 engines.

It does not calculate Session, PB or Development Trend truth itself. Instead it converts the already-tested engine outputs into stable UI states and labels.

### Training state

- `no_sessions` — no genuine structured Session history;
- `partial_only` — structured Session activity exists but no completed Session yet;
- `one_session` — first completed Session recorded;
- `established` — two or more completed Sessions / established history.

### Assessment state

The locked Stage 0 matrix is represented directly:

- 0 completed Assessments → `no_baseline`;
- 1 completed Assessment → `baseline_established`;
- 2 completed Assessments → `comparison_available`;
- 3+ completed Assessments → `trend_ready`.

The first completed benchmark still produces zero fake PB messaging. It is explicitly presented as baseline establishment.

### Development state

Development readiness is based on genuine shared-tag/Test history:

- no observed baseline → `no_baseline`;
- tag baselines but no comparison-ready Test history → `baseline_established`;
- comparison-ready Development data with two Assessments → `comparison_available`;
- comparison-ready Development data with 3+ Assessments → `trend_ready`.

The Stage 3 engine remains responsible for directional truth.

## Assessment schedule presentation

Stage 4 composes the existing recurring Assessment schedule engine into the Progress view-model.

The shell understands:

- `upcoming`;
- `due`;
- `overdue`;
- `in_progress`;
- `completed`;
- no/unknown schedule.

For the real current family baseline, the first recurring benchmark is shown as scheduled rather than inventing an Assessment result.

Dates are formatted deterministically in UK presentation form from `YYYY-MM-DD` values without browser-timezone drift.

## `ProgressDashboard`

The new component is deliberately outside the already-large `App.jsx` statistics memo.

It loads the existing definition/history sources through their established APIs:

- `loadSessionLibrary(...)`;
- `loadAssessmentLibrary(...)`;
- `loadCompletedAssessmentHistory(...)`;
- `listAssessmentRuns(...)`;
- `listAssessmentSchedules(...)`.

It then composes:

1. `buildTrainingProgress(...)`;
2. `buildAssessmentProgress(...)`;
3. `buildDevelopmentTrendsFromAssessmentProgress(...)`;
4. `buildAssessmentScheduleStatuses(...)`;
5. `buildProgressViewModel(...)`.

This preserves the Phase 3 architecture:

`trusted history engines → pure Progress aggregation/view-model → UI`

rather than duplicating calculations in JSX.

## Current shell content

### Performance Progress header

The shell introduces a focused Progress identity and states that every number comes from genuine recorded activity.

### Data readiness

Training, Assessments and Development each show their current early-history state so zero data is intentional rather than appearing broken.

### Training Progress

The first shell shows:

- Sessions this week;
- Sessions this month;
- current workout streak;
- current XP;
- structured Session training time over the rolling four-week window;
- explicit recorded executions over the rolling four-week window.

Only Stage 1 structured Session truth feeds these Session metrics.

### Session Balance

The shell displays the Stage 1 rolling 28-day Session Balance model, including zero-count active Templates. Therefore the current A/B/C structure remains visible even before the first structured Session is logged.

Legacy workouts are not reclassified as Sessions.

### Benchmark Progress

The first shell displays:

- completed benchmark count;
- latest completed benchmark date;
- genuine latest-run PB count only after comparison history exists;
- recurring Assessment schedule status.

The first benchmark still establishes baseline and does not show a fake PB total.

An `Open Assess` action routes into the existing Assess destination.

### Development Trends shell

Stage 4 exposes Development readiness and shared Development Tag counts/comparison readiness.

Detailed Assessment charts and Development Trend rows remain Stage 6. Stage 4 does not pre-emptively fabricate those displays while production has no Assessment history.

## Error handling

Progress data loading is isolated from the legacy Stats area.

If one remote Progress source fails:

- the Progress shell remains mounted;
- a clear partial-data warning is shown;
- Retry reloads the remote Progress sources;
- existing legacy Stats remain available underneath;
- no history is mutated as part of retry.

This prevents an Assessment-library/network failure from removing the user's established statistics area.

## Navigation migration

The existing main route keys remain:

`log · stats · plan · assessments · rewards`

Only the visible label changes:

`Stats` → `Progress`

This is intentional.

Stage 4 does **not** add a new `progress` route beside `stats`. The existing `stats` destination is evolved in place, keeping the main navigation compact and avoiding route/state duplication.

A dedicated integration regression test now protects this contract.

## Legacy Stats parity bridge

Inside the existing `tab === "stats"` route, rendering order is now:

1. `ProgressDashboard`;
2. existing legacy Stats grid.

The old Highlights, Records, weekly chart, exercise progress and cardio progress content is not removed or rewritten in Stage 4.

This fulfils the Stage 0 safety rule that legacy Stats stays available until the new Progress area has proven parity. Stage 7 owns the guarded parity decision/cleanup.

## App integration method and cleanup

Because `App.jsx` is already very large, the mechanical integration was applied with a temporary guarded branch-only patch workflow/script rather than replacing the full file through an unsafe manual reconstruction.

The temporary patch:

- added the `ProgressDashboard` import;
- changed only the visible `stats` label to `Progress`;
- mounted the Progress shell inside the existing `stats` render branch;
- retained the legacy Stats grid directly underneath;
- wired current family/profile/log/streak/XP state and Assess navigation.

The temporary workflow and patch script were deleted immediately after the integration commit. They are not part of the clean Stage 4 branch state.

A source-level integration contract test now guards the resulting App wiring instead.

## Stage 4 automated coverage

Stage 4 adds 16 tests:

### `progressViewModel` — 9 tests

Covers:

- deterministic UK date formatting;
- no/partial/one/established Session states;
- 0/1/2/3+ Assessment states;
- Development baseline/comparison/trend readiness;
- real zero-history model;
- first benchmark baseline behaviour;
- second benchmark comparison behaviour;
- 3+ trend-ready behaviour;
- schedule state summaries.

### `ProgressDashboard` — 4 tests

Covers:

- real zero-history rendering with the recurring benchmark schedule;
- explicit no-fake-history state;
- Assess navigation callback;
- partial remote-load failure resilience;
- Retry behaviour.

The first Stage 4 shell CI run correctly exposed a test-selector ambiguity because the same scheduled benchmark date intentionally appears both in baseline guidance and in the dedicated schedule card. The UI behaviour was correct; the test was tightened to assert the intentional duplicate occurrence.

### App integration contract — 3 tests

Protects:

- five-route navigation with visible `Progress` label rather than a sixth route;
- Progress shell rendering before legacy Stats;
- preservation of legacy `Highlights` content;
- explicit live family/profile/log/streak/XP wiring;
- Assess navigation bridge.

## Final Stage 4 code gate

Final code head before this documentation commit:

`70b7dc2380edf5d42d618310a13c3ae53290c005`

Permanent Workout Tracker CI:

- run #286 / ID `34453435044`: success;
- 35/35 test files passed;
- 373/373 tests passed;
- `progressTrainingEngine`: 18/18;
- `progressAssessmentEngine`: 17/17;
- `progressDevelopmentTrendEngine`: 18/18;
- `progressViewModel`: 9/9;
- `ProgressDashboard`: 4/4;
- `progressAppIntegration`: 3/3;
- Vite 8.2.2 production build passed;
- 667 modules transformed;
- npm audit: 0 vulnerabilities.

The exact code head also received a successful Vercel preview status.

## Live production safety verification

Stage 4 performs no database writes.

Read-only verification after the completed App integration reports:

- workout logs: 499;
- logs containing structured Session blocks: 0;
- Assessment runs: 0;
- completed Assessments: 0;
- Assessment Test results: 0;
- active recurring Assessment schedules: 2;
- active shared Development Tags: 10;
- Test/Development-Tag links: 48.

Protected profile-plan fingerprints remain exactly:

- Paul: `a715c519932be388cebe88722439de8b`;
- Wilf: `278e036e425e2eeff7b02b417029403f`;
- Xander: `b3b95dc0668da96dfcfeccdea21b6cfe`.

No fake Wilf/Xander Session or Assessment history has been created.

## Explicit Stage 4 boundaries

Stage 4 does not yet implement the detailed Stage 5/6 visualizations.

It does not yet add:

- Training history charts based on structured Sessions;
- detailed Movement totals UI;
- expanded Session Distribution graphics;
- Assessment Test history charts;
- detailed biggest-improvement/decline lists;
- individual Development Trend rows/arrows;
- final range/filter controls;
- full responsive/brand parity pass;
- removal of legacy Stats.

It also does not make Phase 4 causal claims or recommendations.

## Stage 4 acceptance

Stage 4 is complete when:

- Stats visibly evolves to Progress without a sixth main tab;
- the Stage 1–3 engines are composed through a pure view-model;
- the real 0-history production state is purposeful;
- 1/2/3+ Assessment states are deterministic;
- recurring Assessment context appears without fake history;
- current streak/XP remain visible;
- Session Balance stays honest and zero-filled;
- legacy Stats remains available beneath the shell;
- Progress load failures do not destroy legacy Stats access;
- full tests/build/audit are green;
- production history and protected plans remain unchanged.

All acceptance conditions are satisfied.

Next: Phase 3 / Stage 5 — Training cards/charts, Session Distribution and Movement totals UI using the Stage 1 engine outputs already exposed by this shell.
