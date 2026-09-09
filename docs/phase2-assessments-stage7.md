# Phase 2 Assessments — Stage 7 Football Monthly Benchmark

Status: complete on `feature/phase2-assessments`.

Stage 7 turns the generic Assessment architecture from Stages 1–6 into the first real shared benchmark for the initial family use case. It seeds definition data only. It does not create an athlete Assessment run/result, rewrite workout logs, or change any profile weekly plan.

## Source-driven scope

The Workout Tracker development brief requires one reusable `Football Monthly Benchmark` Assessment Template with Athletic and Technical sections, while keeping the architecture generic and template-driven.

The boys' current training guide supplies the concrete four-week test protocols and consistency rules. Stage 7 therefore uses those protocols rather than inventing demonstration scores or hard-coding football behavior in application/database structure.

The benchmark is intended to run every four weeks under repeatable conditions. The technical benchmark may replace one normal 15-minute skills Session in test week. Actual recurring plan integration remains Stage 8.

## Seeded definition set

Live Stage 7 definition counts:

- Assessment Templates: 1
- canonical Tests: 20
- Assessment Template/Test memberships: 20
- Test/Development-Tag links: 48
- Assessment runs: 0
- Assessment Test results: 0

Template:

- `Football Monthly Benchmark`
- category: `Football`
- version: 1
- active
- 6 Athletic Tests
- 14 Technical Tests
- positions are contiguous 1–20
- every membership has explicit instructions and protocol text

## Athletic section

| # | Test | Metric contract |
|---|---|---|
| 1 | 10 m acceleration | time, seconds, lower is better, 3 attempts, best retained |
| 2 | Standing broad jump | distance, cm, higher is better, 3 attempts, best retained |
| 3 | Strict press-ups | clean repetitions, single scored set, higher is better |
| 4 | Pull-ups | clean repetitions, single scored set, higher is better |
| 5 | Single-leg calf raises | repetitions, separate left/right dimensions, higher is better |
| 6 | Toe-touch flexibility | signed distance in cm, higher is better, negative values allowed |

Athletic Development Tags:

- 10 m acceleration → `Acceleration`, `Power`
- Standing broad jump → `Power`
- Strict press-ups → `Strength`
- Pull-ups → `Strength`
- Single-leg calf raises → `Strength`
- Toe-touch flexibility → `Mobility`

These four generic tags were added to the existing shared Development Tag library:

- Strength
- Power
- Acceleration
- Mobility

No Assessment-only tag system was introduced.

## Technical section

| # | Test | Metric contract |
|---|---|---|
| 7 | Sole rolls | clean reps in 30 s |
| 8 | Drag-backs | clean reps in 30 s |
| 9 | Scissor + cut | clean reps in 30 s |
| 10 | Side-foot drags | clean reps in 30 s |
| 11 | Flip-flap out → in | 30 s scored window per side; separate L/R reps |
| 12 | Flip-flap in → out | 30 s scored window per side; separate L/R reps |
| 13 | Stop & go | successes from exactly 10 trials |
| 14 | Inside-foot receiving | successes from exactly 10 feeds |
| 15 | Outside-foot receiving | separate L/R successes, 5 feeds per side |
| 16 | Laces cushion | successes from exactly 10 feeds |
| 17 | Protected side-on outside-foot receive | separate L/R successes, 5 feeds per side |
| 18 | First touch through gate | separate L/R successes, 5 attempts per side |
| 19 | Weak-foot keepy-uppys | best touches from 3 scored attempts |
| 20 | Moving keepy-uppys | best touches from 3 scored attempts |

Technical Tests mirror the existing football Session Movement tags rather than linking directly to Movements:

- close-control Tests → `Football`, `Close Control`, `Ball Manipulation`
- receiving/first-touch Tests → `Football`, `First Touch`, `Receiving`
- weak-foot keepy-uppys → `Football`, `Ball Manipulation`, `Weak Foot`
- moving keepy-uppys → `Football`, `Ball Manipulation`

This preserves the planned generic Training ↔ Development Tag ↔ Testing relationship for later analysis.

## Fixed-trial generic refinement

Stage 7 exposed an important generic distinction in the pre-existing metric contract:

- `attempt_count` means the number of result entries/attempts used by retention logic (for example best of 3);
- a result such as `8/10` is one attempts/successes result produced from a fixed number of trials.

Those concepts must not be conflated.

Stage 7 therefore extends `metric_config` with optional `fixedAttempts` for `attempts_successes` Tests.

For a fixed-trial Test:

- the runner pre-fills the configured number of trials;
- the trial-count input is locked;
- the athlete/parent only enters successes;
- the metric engine rejects a result whose stored trial count differs from the frozen protocol;
- the authoring UI exposes `Fixed trials per result` in metric details;
- changing fixed trials breaks history compatibility when raw successes are the comparison value;
- changing fixed trials does not break compatibility when the Test explicitly compares by success rate, because the retained comparison meaning remains a percentage.

This is generic and supports any fixed-shot, fixed-attempt, accuracy or skill Test rather than being football-specific.

## Side-specific modelling decisions

Where the real protocol measures both sides, Stage 7 uses one canonical Test with `side_mode = separate` rather than creating two unrelated Test identities.

This applies to:

- Single-leg calf raises
- Flip-flap out → in
- Flip-flap in → out
- Outside-foot receiving
- Protected side-on outside-foot receive
- First touch through gate

That allows Stage 6 to retain independent left/right PBs and trends while keeping one coherent canonical Test identity.

The training guide describes outside-foot receiving as 10 feeds with R/L/total recording but does not explicitly prescribe the split. Stage 7 standardises that initial protocol to 5 feeds per side so future monthly scores are repeatable. The stored L/R results preserve all information needed to derive a total if a later view wants to show one.

For flip-flaps, the source says to test right and left separately where practical. Stage 7 makes that repeatable by using a 30-second scored window for each side.

## Protocol integrity decisions

### Pull-ups

The same grip and assistance condition should be used each month. Any assistance band is recorded in the Test notes. A material assistance change should be treated as a new Test level rather than pretending the scores are directly comparable.

### Single-leg calf raises

The scored test is capped at 30 clean reps per side, matching the current guide. The cap is protocol text rather than a football-specific database constraint.

### Toe-touch flexibility

The result is signed:

- short of toes = negative cm
- beyond toes = positive cm

The Test deliberately sets percentage improvement to `never`. Absolute change/PB/history remain available, but a percentage around a signed zero-crossing would be misleading.

### First-touch gate

The protocol keeps the gate approximately 1 m wide, roughly 3–4 m from the feeder and around 45 degrees from the receiving line through the current block. If the gate/control area is later made harder, that should be treated as a new Test level rather than mixing incompatible scores.

### Optional aerobic marker

The training guide says this is optional and not required in Block 1. Stage 7 therefore does not seed it.

## Seed source control

The exact initial-family seed is retained at:

`supabase/seeds/20260909_football_monthly_benchmark.sql`

It is a data seed, not a schema migration. It is deliberately guarded against being blindly rerun once Assessment definitions already exist for the target family.

## Automated verification

Before the live seed, Stage 7 added regression coverage for the generic fixed-trial refinement.

Clean permanent branch gate after temporary patch machinery was removed:

- branch code head: `b73d46ab87e870916900aeb228cc0975fc8af931`
- PR merge ref tested: `80423fa3cb7e56f806277b6aef3dadcc55b7a8af`
- Workout Tracker CI run #217 / ID `34399019760`
- 27/27 test files passed
- 289/289 tests passed
- `assessmentMetricEngine`: 38 tests
- `assessmentHistoryEngine`: 15 tests
- `AssessmentResultInput`: 8 tests
- Vite 8.2.2 production build passed
- 659 modules transformed
- npm audit: 0 vulnerabilities

The seed-file head `13e0ef3d44c33058d0e436ebf48b03f0ce5dc390` also passed permanent CI (run #218) and received a successful Vercel preview status.

## Live Supabase verification

After the Stage 7 transaction:

- `Football Monthly Benchmark`: 1 active Template, version 1
- Athletic memberships: 6
- Technical memberships: 14
- distinct ordered positions: 20, from 1 through 20
- canonical Tests: 20
- all Tests active
- all membership instructions present
- all membership protocols present
- Test/Development-Tag links: 48
- shared Development Tags: 10 (the original 6 plus 4 new generic Athletic tags)
- Assessment runs: 0
- Assessment Test results: 0
- workout logs: 499

Protected profile-plan fingerprints remain exactly:

- Paul: `a715c519932be388cebe88722439de8b`
- Wilf: `278e036e4257e2eeff7b02b417029403f`
- Xander: `b3b95dc0668da96dfcfeccdea21b6cfe`

Existing Session definition/history structure remains intact:

- Programmes: 1
- Movements: 15
- Session Templates: 3
- Session Template Movements: 17
- Movement/Development-Tag links: 44

The Development Tag count intentionally changed from 6 to 10 because the tag table is shared by Sessions and Assessments; no existing Movement/Tag link was changed.

`assessment_runs` and `assessment_test_results` still have RLS enabled with three policies each. The authenticated application role still has only `INSERT, SELECT, UPDATE` on those history tables; no anonymous grant or history delete route was introduced.

## Baseline behavior

No fake or imported Assessment history was created.

Therefore:

- Wilf currently has no Assessment baseline;
- Xander currently has no Assessment baseline;
- when each athlete completes this benchmark for the first time, that athlete's retained valid results automatically become their original Stage 6 baseline;
- later completed runs derive previous result, improvement, PB and trend from that real history.

This preserves the product principle that the athlete's own measured progress is the primary comparison.

## Explicit Stage 7 boundaries

Stage 7 does not:

- schedule the benchmark into Wilf or Xander's weekly plan;
- replace a specific Session automatically;
- create historical Assessment scores;
- award Assessment XP/badges;
- build the Phase 3 Progress Dashboard;
- perform training-to-test analysis or make causal claims;
- introduce football-specific schema.

Next: Stage 8 — integrate recurring benchmark use into the Wilf/Xander workflow without rewriting history.