# Phase 2 Assessments — Stage 2 Metric/Result Engine

Status: complete.

Stage 2 adds the generic application-layer metric/result engine used by future Assessment authoring, logging and history features. It makes no database/schema, live-plan, workout-log or seed-data changes.

## Engine

File: `src/engine/assessmentMetricEngine.js`

The engine accepts the generic Test definition created in Stage 1 and normalises both snake_case database rows and camelCase application objects.

Supported definition controls:

- `metric_type`
- `unit`
- `scoring_direction`: `higher` or `lower`
- `attempt_count`
- `result_strategy`: `single`, `best`, `average`
- `side_mode`: `none`, `separate`
- `allow_negative`
- `pb_eligible`
- extensible `metric_config`

## Result processing

For scalar metrics the engine:

- validates and rounds entered attempts;
- rejects negative values unless explicitly allowed;
- supports direct scalar, `value`, or attempts-array input forms;
- retains the first valid value for `single`;
- chooses max/min correctly for `best` according to scoring direction;
- calculates an arithmetic mean for `average`;
- returns both a retained result and scalar comparable value.

For `attempts_successes` / `successes_attempts` metrics the engine:

- validates integer attempts/successes;
- rejects successes greater than attempts;
- can compare by raw successes or success rate;
- supports single/best retention;
- deliberately rejects `average` because averaging attempt/success pairs is ambiguous without a defined aggregation protocol.

## Left/right dimensions

`side_mode: separate` produces independent left and right dimensions.

The engine does not collapse those into an overall scalar. It returns:

- side-specific attempts;
- side-specific retained results;
- side-specific comparable values;
- side-specific comparison status.

This preserves weak-side history for Phase 6 and later analysis.

## Formatting

Formatting is definition-driven and supports:

- generic unit suffixes;
- configurable decimal places;
- optional fixed-decimal display;
- attempts/successes display;
- optional success-rate display;
- em dash for missing/invalid values.

## Comparison semantics

The engine separates raw measurement change from performance improvement.

Example for a lower-is-better sprint:

- previous: 2.00 s
- current: 1.80 s
- raw change: -0.20 s
- performance improvement: +0.20 s
- percentage improvement: +10%

This keeps chart/history data mathematically transparent while still allowing the UI to communicate improvement consistently.

## Percentage-improvement safety

Percentage improvement is intentionally guarded.

By default it is not produced when:

- either comparison value is missing;
- the previous/baseline comparable value is zero or negative;
- the metric allows signed/negative values;
- the Test explicitly sets `metric_config.percentageImprovement = "never"`.

Signed metrics may opt in explicitly with `percentageImprovement = "allow"`, but this should only be used where the resulting percentage is genuinely meaningful.

This prevents misleading percentages around zero-crossing values such as toe-touch flexibility.

## Automated tests

Files:

- `src/engine/assessmentMetricEngine.test.js` — 37 tests
- `src/engine/assessmentMetricEngine.edge.test.js` — 4 regression tests

Stage 2 added 41 Assessment metric tests.

The first CI run correctly exposed two JavaScript coercion edge cases:

1. empty `{}` was initially classified as one malformed numeric attempt rather than a missing result;
2. `Number(null)` initially allowed a missing comparison value to behave like zero.

Both were fixed at the engine boundary and locked with regression tests.

Final permanent CI on the PR merge ref:

- 14 test files passed
- 171/171 tests passed
- Vite 8.2.2 production build passed
- npm audit: 0 vulnerabilities
- Vercel preview: success

## Stage 2 boundary

Stage 2 does not:

- read/write the new Assessment tables;
- create Assessment Templates or Tests;
- seed the Football Monthly Benchmark;
- alter workout logs or profile plans;
- calculate historical PBs across stored runs yet.

Those responsibilities remain in later stages.

Next: Stage 3 — Assessment DB access and library controller.