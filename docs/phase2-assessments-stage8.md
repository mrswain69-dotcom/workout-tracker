# Phase 2 Assessments — Stage 8 Recurring Benchmark Workflow

Status: complete on `feature/phase2-assessments`.

Stage 8 makes the Assessment system operational for recurring real-world use while preserving the historical and plan-safety boundaries established in Stages 0–7.

## Source requirement

The current Wilf/Xander training guide says the football technical benchmark should run every four weeks under the same setup. It may replace one normal 15-minute skills Session during test week, and the technical test should be kept separate from a hard strength session or match so fatigue does not distort the scores.

The guide also describes the first 1–2 weeks of the current 6–8 week block as a return-to-routine ramp after the summer break.

Stage 8 preserves those rules without rewriting the boys' normal weekly `profiles.plan_json` every fourth week.

## Architecture decision — schedule Assessment, do not mutate weekly plans

A recurring benchmark is not stored by repeatedly inserting/removing blocks from a profile's weekly plan.

Instead Stage 8 adds a generic first-class schedule definition:

`assessment_schedules`

Each schedule belongs to:

- a family;
- one athlete/profile;
- one Assessment Template.

It defines:

- `start_date`;
- `cadence_days`;
- `window_days`;
- extensible `workflow_config` JSON;
- active/inactive state.

This keeps three separate concepts separate:

1. weekly training plan;
2. recurring Assessment expectation;
3. immutable Assessment history.

No historical workout log or existing profile plan needs to be rewritten when a new four-week cycle starts.

## Generic schedule states

`assessmentScheduleEngine.js` derives schedule state from the schedule definition plus real Assessment history.

Supported states:

- **Upcoming** — first/current benchmark window has not started yet;
- **Due this week** — inside the configured benchmark window with no completed run;
- **Overdue** — the recommended window has passed but the next cycle has not started;
- **In progress** — a matching immutable Assessment run has been started and can be resumed;
- **Completed this cycle** — a matching completed run exists in the current cycle.

A completion after the recommended seven-day window but before the next 28-day cycle still satisfies that cycle. This allows real-life scheduling flexibility without shifting the recurring calendar forever.

At the next cadence boundary a fresh cycle is derived automatically. No new schedule row or plan mutation is required.

## History identity and safety

Schedule completion is determined only from Assessment runs matching both:

- the schedule's profile;
- the schedule's Assessment Template.

A sibling's result cannot satisfy another athlete's schedule, and completing another Assessment cannot satisfy the Football Monthly Benchmark schedule.

An existing `in_progress` run takes priority so the UI resumes the frozen Stage 5 snapshot instead of creating a second competing run.

The schedule itself creates no result data. Only deliberately starting the Assessment creates an immutable run through the existing Stage 5 controller.

## Assess Hub integration

The existing athlete-facing Assess Hub now loads:

- active Assessment definitions;
- the selected profile's in-progress Assessment runs;
- the selected profile's completed Assessment runs needed for schedule status;
- the selected profile's active Assessment schedules.

A new **Scheduled benchmarks** area appears above ad-hoc Assessment cards.

Depending on state it shows:

- benchmark name;
- schedule cadence/window;
- current or first benchmark window;
- Upcoming / Due this week / Overdue / In progress / Completed this cycle status;
- workflow guidance;
- `Start scheduled benchmark` when due/overdue;
- `Resume` when already in progress;
- next benchmark start after completion.

The scheduled Start/Resume actions reuse the existing immutable Assessment runner. There is no second result system.

Ad-hoc Assessment starts remain available. Scheduling is an additional workflow layer, not a restriction on the generic Assessment system.

## Training-session replacement boundary

The guide says the technical benchmark **may** replace one normal 15-minute home skills Session during test week.

Stage 8 deliberately treats this as workflow guidance rather than falsifying a Session completion:

- it does not mark an unperformed Session A/B/C as completed;
- it does not award Session completion XP for a Session that did not happen;
- it does not alter the workout log to pretend the normal Session occurred;
- it does not silently modify weekly `plan_json` during benchmark week.

The Assessment itself remains truthful Assessment history. A later Progress/consistency layer can understand benchmark weeks explicitly rather than inheriting fabricated Session history.

## Initial Wilf/Xander schedule

Two active profile-scoped schedules are seeded against the existing shared `Football Monthly Benchmark`:

- Wilf → Football Monthly Benchmark
- Xander → Football Monthly Benchmark

Both use:

- first benchmark window start: **2026-09-21**;
- cadence: **28 days**;
- recommended window: **7 days**;
- first window: **2026-09-21 through 2026-09-27**.

The 2026-09-21 anchor is an implementation decision for the initial family rollout, not a date stated by the training guide. It was chosen to put the first formal benchmark after the guide's 1–2 week return-to-routine ramp while retaining the required four-week cadence.

The stored workflow guidance says:

1. the technical benchmark may replace one normal 15-minute home skills Session during benchmark week;
2. keep benchmark testing separate from a hard strength session or match so fatigue does not distort scores;
3. keep setup/equipment/conditions as consistent as practical each cycle.

`allowSplitAcrossDays` is enabled because the combined Athletic + Technical Assessment is larger than a single short skills block. The existing Stage 5 save/resume design allows a clean split without changing the frozen Test definitions.

## Database security

`assessment_schedules`:

- has RLS enabled;
- has family-owner SELECT / INSERT / UPDATE policies;
- grants authenticated users SELECT / INSERT / UPDATE only;
- grants no anonymous access;
- exposes no DELETE route in the Stage 8 DB adapter;
- uses soft `active=false` scheduling rather than a destructive delete API.

A follow-up index covers the `profile_id` foreign key after the Supabase performance advisor identified that the initial family-leading compound index did not count as a covering FK index.

Supabase security advisors reported no new Stage 8 table/RLS issue. The existing project-level leaked-password-protection advisory remains separate from this work.

## Automated regression gate

The permanent Stage 8 code adds:

- `src/assessmentScheduleDb.js`;
- `src/assessmentScheduleDb.test.js`;
- `src/engine/assessmentScheduleEngine.js`;
- `src/engine/assessmentScheduleEngine.test.js`;
- recurring schedule integration in `AssessmentHub.jsx`;
- schedule UI regression coverage in `AssessmentHub.test.jsx`;
- the additive Assessment schedule migrations;
- the guarded initial schedule seed.

Guarded UI integration gate:

- 29/29 test files passed;
- 304/304 tests passed;
- schedule engine: 10/10 tests;
- schedule DB adapter: 3/3 tests;
- Assessment Hub: 8/8 tests;
- Vite 8.2.2 production build passed;
- 661 modules transformed;
- npm audit: 0 vulnerabilities.

The first guarded UI attempt intentionally committed nothing because one locale-sensitive display assertion expected `21 Sep` while the CI locale rendered `Sep 21`. The test was corrected to be locale-neutral and the full guarded gate then passed before permanent UI code was committed.

Temporary patch scripts/workflows were removed after the permanent integration committed.

## Live Supabase verification

After Stage 8 activation:

- workout logs: 499;
- Assessment Templates: 1;
- canonical Tests: 20;
- Assessment Template/Test memberships: 20;
- Test/Development-Tag links: 48;
- recurring Assessment schedules: 2;
- Assessment runs: 0;
- Assessment Test results: 0;
- Programmes: 1;
- Movements: 15;
- Session Templates: 3;
- Session Template Movements: 17;
- shared Development Tags: 10;
- Movement/Development-Tag links: 44.

Protected profile-plan fingerprints remain exactly:

- Paul: `a715c519932be388cebe88722439de8b`
- Wilf: `278e036e425e2eeff7b02b417029403f`
- Xander: `b3b95dc0668da96dfcfeccdea21b6cfe`

Assessment history remains empty until Wilf/Xander genuinely perform the benchmark. Their first completed runs therefore still become their real Stage 6 original baselines.

## Explicit Stage 8 non-goals

Stage 8 does not:

- manufacture baseline scores;
- rewrite historical workout logs;
- mutate weekly profile plans every fourth week;
- automatically claim a normal Session was completed because an Assessment occurred;
- award Assessment XP or badges;
- build Phase 3 dashboard charts/session-balance analysis;
- make causal training-performance claims;
- add football-specific schedule schema.

## Phase 2 position after Stage 8

The operational loop now exists:

**weekly training → recurring benchmark due state → immutable benchmark run → completed Test history → next four-week cycle**

The Development Tag layer remains ready for Phase 3/4 to connect the training performed between two real benchmark results.

Next: **Stage 9 — full Phase 2 regression, production merge/deployment and post-deploy verification.**
