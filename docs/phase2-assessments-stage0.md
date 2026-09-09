# Phase 2 Assessments — Stage 0 Baseline & Architecture

Status: Stage 0 complete; no application logic, database schema, live plans, or historical logs changed.

## Objective

Phase 2 implements the Assessment side of the development brief while preserving the generic, template-driven design established in Phase 1.

Source hierarchy from the brief:

- Programme → Session Template → Movement → Tracking Method
- Assessment Template → Test → Metric
- Movements and Tests may share Development Tags

Phase 2 scope from the brief:

- Assessment templates
- metrics
- complete test history
- PB detection
- comparison with previous result and original baseline

The initial use case is the shared Wilf/Xander Football Monthly Benchmark, but no football-specific database structure is permitted.

## Production baseline locked for Phase 2

Repository: `mrswain69-dotcom/workout-tracker`

- baseline branch: `main`
- baseline commit: `f19a10cf249a9f7ab100a0e8715e04f1ca3c619f`
- production Vercel status at baseline: success
- permanent Workout Tracker CI at baseline: success
- tests at baseline: 130/130 across 12 files
- npm audit at baseline: 0 vulnerabilities
- Node/CI baseline: Node 24, actions/checkout@v7, actions/setup-node@v7, npm ci with committed package-lock.json

Live Supabase project: `chdoyavyydwaewpuzbsb`

Family baseline (`f483eb48-b1cd-4b36-899a-49d69ae8ae8b`):

- historical logs: 499
- historical log fingerprint: `91b10f9431340a9f82c7aaa179974972`
- Paul plan fingerprint: `a715c519932be388cebe88722439de8b`
- Wilf plan fingerprint: `278e036e425e2eeff7b02b417029403f`
- Xander plan fingerprint: `b3b95dc0668da96dfcfeccdea21b6cfe`
- Session Library: 1 programme / 15 movements / 3 templates / 17 template movements / 6 development tags / 44 movement-tag links
- existing Assessment/Test tables: none

Stage 0 safety invariant: Phase 2 must not rewrite the 499 pre-existing workout logs or silently alter current profile plans.

## Compatibility findings

### 1. Phase 1 already created the shared bridge Phase 2 needs

`development_tags` and `movement_development_tags` are generic family-owned tables. The Phase 1 migration explicitly described Development Tags as the foundation for later Assessment linking.

Current active tags:

- Football
- Close Control
- First Touch
- Receiving
- Weak Foot
- Ball Manipulation

Phase 2 should reuse `development_tags`, adding only further generic tags required by Assessment templates (for example Strength, Acceleration, Mobility, Power or Balance) rather than introducing an Assessment-only tag system.

### 2. Assessment data should be additive and first-class

Assessment history should not be embedded as mutations of existing workout `logs.log_json`. The brief describes Assessment as a first-class item with complete Test history. A separate additive Assessment history model avoids contaminating workout history and allows monthly or ad-hoc Assessments to exist independently of a daily workout log.

### 3. Reuse the successful Session definition pattern

Phase 1 established a useful pattern:

- editable family-owned definitions
- canonical reusable items
- ordered template rows
- soft archive
- versioned definitions
- immutable snapshots at the point of historical use
- historical calculations derived from retained history rather than permanently claimed state

Assessments should follow the same pattern.

## Stage 0 architecture decision

The Phase 2 data model should use the following generic concepts.

### Definition layer

#### `assessment_templates`
Family-owned editable Assessment definitions.

Expected responsibilities:
- name / description / category
- version
- sort order
- soft archive

#### `tests`
Canonical reusable Test definitions, analogous to canonical Movements.

Expected responsibilities:
- name / description
- version
- metric type
- unit
- scoring direction (`higher` or `lower`)
- configured attempt count
- retained-result strategy (`best`, `average`, or an appropriate single/fixed result mode)
- side mode (`none` / separate left-right where relevant)
- negative-value allowance where required (for example toe-touch)
- PB eligibility
- extensible metric configuration JSON
- soft archive

Keeping Test identity canonical means the same Test can be reused in more than one Assessment Template while retaining one coherent personal history.

#### `assessment_template_tests`
Ordered membership of Tests inside an Assessment Template, analogous to `session_template_movements`.

Expected responsibilities:
- assessment template
- canonical test
- position
- optional section/group label (for example Athletic / Technical)
- display label / instructions / protocol text
- optional template-specific configuration override only where genuinely needed

#### `test_development_tags`
Many-to-many relationship between canonical Tests and the existing shared `development_tags` table.

There should be no football-specific direct relationship between a Test and a Movement. Their intended relationship is through shared Development Tags, as specified by the brief.

### History layer

#### `assessment_runs`
One athlete performing one Assessment Template on a particular occasion.

Expected responsibilities:
- family / profile
- source Assessment Template ID
- date / start / completion status
- definition version
- immutable Assessment definition snapshot sufficient to interpret the historical run after future edits

#### `assessment_test_results`
One Test result within an Assessment run.

Expected responsibilities:
- assessment run
- canonical Test ID
- ordered/template-test reference where applicable
- immutable Test/metric snapshot
- entered attempt/result data
- retained result data
- a normalized comparable value where a scalar comparison is meaningful
- optional notes / validity state

Raw/result detail should remain flexible enough for:
- time
- distance
- repetitions
- successes / attempts
- signed numeric values
- best-of-N
- average-of-N
- separate left/right values

## Metric engine boundary

Metric interpretation belongs in a tested application engine rather than being scattered through UI components.

The Phase 2 metric engine should be responsible for:

1. validating entered attempts/results;
2. retaining the configured best/average/single result;
3. producing a comparable value or comparable dimensions;
4. formatting the display value and unit;
5. comparing higher-is-better and lower-is-better results correctly;
6. supporting left/right dimensions without inventing separate hard-coded metric types;
7. allowing signed values where configured;
8. determining whether percentage improvement is meaningful and safe to display.

## PB and baseline rules

PB state must be derived from Assessment history rather than stored as an irreversible achievement claim.

This preserves the existing Workout Tracker principle that if historical data is corrected, derived statistics should update to reflect the corrected history.

For each canonical Test/profile, Phase 2 must be able to derive:

- current/latest valid result
- previous valid result
- absolute change
- percentage change where mathematically meaningful
- all-time PB
- original baseline (earliest valid result)
- improvement from baseline
- trend/history

Left/right Tests must preserve side-specific history so future weak-side improvement analysis remains possible.

## Historical definition protection

Editing or archiving an Assessment Template or Test must affect future use only.

Every completed/in-progress Assessment run must preserve enough of the definition used at the time to continue displaying and comparing its historical results even when:

- a Test is renamed;
- its instructions change;
- its metric configuration changes;
- Tests are reordered/removed from a Template;
- the Template itself is archived.

The Phase 1 immutable-snapshot approach should be reused rather than attempting to freeze editable live definitions.

## Initial Football Monthly Benchmark scope

The brief requires one shared editable Assessment Template for Wilf and Xander with two sections.

Athletic:
- 10 m acceleration
- standing broad jump
- strict press-ups
- pull-ups
- single-leg calf raises — left
- single-leg calf raises — right
- toe-touch flexibility

Technical:
- sole rolls
- drag backs
- scissor + cut
- side-foot drags
- flip-flap out → in
- flip-flap in → out
- stop & go
- inside-foot receiving
- outside-foot receiving
- laces cushion
- protected side-on outside-foot receive
- first touch through gate
- weak-foot keepy-uppys
- moving keepy-uppys

The actual seed and exact protocols are intentionally deferred until the generic Assessment definition/metric/history machinery is built and verified.

## Scheduling boundary

The boys' training guide says the standard Athletic + Football Technical benchmark runs every four weeks and that the technical benchmark may replace a normal 15-minute skills Session during test week.

Stage 0 does not modify weekly `profiles.plan_json` or invent a recurring scheduling structure. Phase 2 should first make Assessments independently usable and historically correct. Scheduling/replacement integration will be a later explicit stage once the Assessment runner/history is stable.

## Explicit non-goals for early Phase 2

Do not mix the following into the Assessment foundation:

- Phase 3 Progress Dashboard
- AI-generated analysis
- causal claims linking training to improvement
- monthly awards / leaderboard scoring
- forced detailed training repetition entry
- React major upgrade
- rewriting historical workout logs
- changing Wilf/Xander weekly Session schedule

## Proposed Phase 2 implementation sequence

- Stage 0 — baseline, requirements, architecture and safety invariants (this document)
- Stage 1 — additive Assessment foundation schema, relationships and RLS
- Stage 2 — generic metric/result engine with automated tests
- Stage 3 — Assessment DB access/library controller
- Stage 4 — Assessment Template/Test authoring UI
- Stage 5 — Assessment runner/logger with immutable snapshots
- Stage 6 — Test history, PB, previous-result and baseline comparison engine/UI
- Stage 7 — seed and verify the shared Football Monthly Benchmark
- Stage 8 — integrate recurring benchmark use into Wilf/Xander workflow without rewriting history
- Stage 9 — full Phase 2 regression, deployment and post-deploy verification

## Stage 1 acceptance guard

Before any Stage 1 schema is considered complete it must be additive, family-owned, RLS-protected, compatible with existing Development Tags, and verified to leave these Stage 0 fingerprints unchanged:

- 499 workout logs / `91b10f9431340a9f82c7aaa179974972`
- Paul plan / `a715c519932be388cebe88722439de8b`
- Wilf plan / `278e036e425e2eeff7b02b417029403f`
- Xander plan / `b3b95dc0668da96dfcfeccdea21b6cfe`

No live Assessment seed data should be inserted during Stage 1.
