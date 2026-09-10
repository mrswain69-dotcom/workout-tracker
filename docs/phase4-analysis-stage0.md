# Phase 4 Analysis — Stage 0 Baseline & Architecture

Status: Stage 0 complete. This stage locks the Phase 4 truth, causation, interval, evidence-detail and recommendation contracts before implementation. No production data, schema, plans, workout history or Assessment history are changed.

## Objective

Phase 4 implements the Analysis layer defined in the Workout Tracker Development Brief.

The brief requires analysis that considers:

- test-to-test improvement;
- related training completed between Assessments;
- training consistency;
- missing / underrepresented Sessions;
- a possible next focus;
- incomplete training data where repetition counting is absent.

It must remain cautious about causation. The system may say that training volume or regular related practice occurred alongside improved test performance. It must not say that the training caused the improvement.

The product remains generic and template-driven. Football is the first use case, not a hard-coded analysis model.

## Phase 4 production baseline

Repository: `mrswain69-dotcom/workout-tracker`

- base branch: `main`
- base/released Phase 3 commit: `83d7304cb0cd1b2ebd5c7f2eacca1eb299bda4ad`
- Phase 3 Progress Dashboard: released to production
- permanent CI at Phase 3 release: 47 test files / 410 tests
- production build: Vite 8.2.2
- npm audit at release: 0 vulnerabilities

Live Supabase project: `chdoyavyydwaewpuzbsb`.

Protected baseline at Phase 4 Stage 0:

- workout logs: 499
- structured Session logs: 0
- Assessment runs: 0
- Assessment Test results: 0
- active recurring Assessment schedules: 2
- active Development Tags: 10
- Movement / Development-Tag links: 44
- Test / Development-Tag links: 48
- Paul plan fingerprint: `a715c519932be388cebe88722439de8b`
- Wilf plan fingerprint: `278e036e425e2eeff7b02b417029403f`
- Xander plan fingerprint: `b3b95dc0668da96dfcfeccdea21b6cfe`

The empty structured-history state remains intentional. Phase 4 will be developed against synthetic automated fixtures; no fake family history will be inserted.

## Existing trusted inputs

Phase 4 composes the released Phase 1–3 truth layers rather than reimplementing them.

### Session side

Existing Session snapshots freeze:

- Programme identity/name;
- Session Template identity/version/name;
- Movement identity/name;
- tracking method/config;
- recorded Movement result;
- Session completion and duration.

`sessionEngine` and `progressTrainingEngine` already provide truthful Session and Movement aggregation without backfilling legacy workouts.

### Assessment side

Assessment run snapshots already freeze each Test's `developmentTagIds` as well as the Test and metric definition.

`progressAssessmentEngine` already provides:

- latest / previous / original baseline context;
- compatible metric comparison;
- genuine PB events;
- improved / declined / unchanged / mixed Test state;
- percentage-safe versus absolute-only improvement handling.

Phase 4 must consume those outputs rather than create a second PB/comparison engine.

### Shared Development Tags

Development Tags remain the generic relationship layer between Movements and Tests.

The current live taxonomy contains 44 Movement↔Tag and 48 Test↔Tag relationships.

## Historical Development-Tag hardening decision

Assessment snapshots already freeze Test Development Tags. Session snapshots currently freeze Movement IDs but not the Movement↔Development-Tag relationship.

Because production currently has zero structured Session history, Phase 4 Stage 1 will harden future Session snapshots by freezing `developmentTagIds` on each Movement snapshot and bumping the Session snapshot schema version.

Rules:

- no existing workout log is rewritten;
- existing v1 Session snapshots remain readable;
- new snapshots prefer their frozen Development Tag IDs;
- older/synthetic snapshots without frozen tags may fall back to the current Movement↔Development-Tag library relation;
- the fallback must be visible in analysis metadata so consumers can distinguish frozen from current-taxonomy evidence.

This prevents future tag editing from silently rewriting the meaning of newly recorded historical training.

## Assessment-pair contract

Analysis is created only when at least two completed Assessments exist for the same athlete and the same Assessment Template.

For a selected/latest completed Assessment:

1. identify the immediately previous completed run of the same Assessment Template;
2. use the Phase 2/3 compatible Test histories for latest-vs-previous comparison;
3. retain original baseline and all-time PB context from the existing Assessment Progress engine.

Different Assessment Templates are never compared as if they were successive versions of one benchmark.

States:

- 0 completed Assessments: `no_baseline`;
- 1 completed Assessment: `baseline_only`;
- 2+ completed Assessments in the same template: `analysis_ready`.

## Training interval contract

Workout logs only provide reliable calendar-day ordering for this use case. They do not establish whether a workout on an Assessment day happened before or after the benchmark.

Therefore the default Phase 4 training interval is deliberately conservative:

`previous Assessment date < training date < latest Assessment date`

Both Assessment dates are excluded from causal-context aggregation unless future timestamped activity data can prove order.

The interval metadata must expose the previous/latest dates and the number of calendar days considered.

## Relevant-training contract

A Test is connected to training through shared Development Tags.

For each comparable latest Test:

1. obtain its frozen Assessment-snapshot Development Tag IDs where available;
2. find Session Movements whose frozen/fallback Movement Development Tag IDs intersect those Test tags;
3. inspect only training inside the Assessment interval;
4. count a relevant completed Session once even if multiple relevant Movements occur inside it;
5. preserve unlike Movement measurements separately.

Relevant training may expose:

- completed relevant Sessions;
- Session Template distribution;
- relevant Movements performed;
- explicit recorded repetitions/executions;
- attempts and successes;
- accuracy where mathematically valid;
- best-score observations separately;
- recorded plan/log appearances where a related Movement existed but no performed result is available.

Raw repetitions, attempts, seconds, distance, weight and scores are never added into one synthetic volume number.

## Incomplete-data evidence ladder

Phase 4 must still provide useful analysis without requiring detailed counting.

### High detail — `high`

At least one related performed Movement has explicit compatible volume evidence such as recorded executions/repetitions or attempts/successes.

Example presentation:

`186 clean receiving repetitions and 143/186 successful attempts were recorded between benchmarks.`

### Medium detail — `medium`

Related structured training was genuinely performed/completed, but no explicit compatible volume count exists.

Example presentation:

`7 completed Sessions contained recorded First Touch practice between benchmarks.`

### Low detail — `low`

A related structured Session/Movement appears in recorded plan/log snapshots during the interval, but performed/completed evidence is insufficient.

Example presentation:

`Related First Touch training appeared in recorded training snapshots during this period, but detailed completion/volume data is incomplete.`

The UI must not upgrade this to a claim of completed practice.

### None — `none`

No related structured evidence is available in the interval.

This means `no related structured training recorded`, not `the athlete did no related training`.

Legacy non-Session workouts are never reverse-mapped into Development Tags.

## Test interpretation language contract

Phase 4 interpretations are descriptive and correlational.

Allowed examples:

- `Outside-foot receiving improved during a period in which regular related practice was recorded.`
- `Training volume increased alongside improved test performance.`
- `The Test declined; related structured practice was also recorded during the interval.`
- `No related structured training was recorded between these benchmarks.`

Disallowed examples:

- `186 repetitions caused the improvement.`
- `Session B made your First Touch better.`
- `You declined because you did not train enough.`

The analysis engine must never infer medical, physiological or coaching causation from correlation.

## Observed training-consistency contract

The brief requires training consistency, but the current production model does not preserve a complete historical planned-day denominator for every day between Assessments. Phase 4 must therefore not pretend it can calculate the Rewards Framework's formal plan-adherence Consistency Score for historical Assessment intervals.

Phase 4 instead calculates an explicitly named **observed structured-training consistency**:

- split the strict between-Assessment interval into consecutive 7-day periods;
- a period is active if at least one completed structured Session occurred;
- report `active periods / eligible periods` and a percentage;
- also retain completed Session count and longest observed gap where useful.

This is a training-rhythm signal, not proof of plan adherence.

If/when immutable historical plan schedules exist, a separate plan-adherence metric may be added without changing the meaning of this Phase 4 measure.

## Missing / underrepresented Session contract

Underrepresentation is evaluated only among active Session Templates that are relevant to the selected Assessment through shared Development Tags.

For each relevant active Session Template:

- count completed Sessions in the strict between-Assessment interval;
- expose zeroes as well as positive counts;
- never count partial Sessions as completed;
- never classify legacy workouts as Session A/B/C;
- historical-only templates may be shown as evidence but are not recommended as an active next focus.

A Session is `underrepresented` only when its completed count is lower than at least one other relevant active Session. Equal distribution does not manufacture a weakest Session.

## Possible-next-focus contract

Phase 4 may produce a cautious possible focus, but it is not an autonomous coach.

Initial deterministic rule:

1. prefer an underrepresented active Session Template that is relevant to the Assessment;
2. if multiple templates tie, use stable template sort/display order;
3. explain only the observable imbalance, e.g. `Session C was completed less often than the other related Sessions between benchmarks.`;
4. if related Sessions are balanced or there is insufficient evidence, return no focus rather than invent one.

The initial release will not prescribe increased load, frequency, weight, sprint volume or recovery changes.

## Overall Assessment Analysis summary

Once two same-template Assessments exist, Phase 4 should be able to summarize:

- previous and latest Assessment dates;
- genuine PB count from the latest Assessment;
- improved / declined / unchanged / mixed Test counts;
- selected Test changes with previous/latest/baseline/PB context;
- total structured Sessions between Assessments;
- relevant Session distribution;
- explicit recorded executions / attempts-successes where available;
- observed structured-training consistency;
- underrepresented related Sessions;
- possible next focus when justified.

The summary can be deterministically generated from structured data. A future AI wording layer may consume this output, but Phase 4 does not require an LLM to determine truth.

## UI placement

Analysis will extend the existing `Progress` destination rather than add another top-level tab.

Planned hierarchy:

`Progress`
→ Training
→ Session Distribution
→ Movement Totals
→ Assessments
→ Development Trends
→ **Assessment Analysis**
→ retained legacy workout Stats compatibility layer

Analysis must have deliberate no-baseline / baseline-only / analysis-ready states so the current family production state remains useful without fake content.

## Database architecture decision

No Phase 4 database summary/cache table is required initially.

Source-of-truth remains:

- immutable Assessment runs/results/snapshots;
- structured Session snapshots in workout logs;
- Session/Assessment definition libraries;
- shared Development Tags.

Phase 4 adds pure/testable application engines and a view-model/UI layer. The only persistence-shape hardening planned is the forward-only optional Development Tag IDs stored inside new Session JSON snapshots; no relational schema migration is required for that change.

## Group / leaderboard boundary after Phase 4

Weekly leaderboards and monthly progress awards are intentionally excluded from Phase 4.

Immediately after Phase 4, the next product build will use `WORKOUT TRACKER - FUTURE EXPANSION ROADMAP v1.0`, Phase 1 — Group & Team Ecosystem, covering group roles, seasonal/consistency/improvement leaderboards, squad PR boards, team improvement views, Top 3 spotlight and related team culture features.

Additional locked requirement from the product owner for that next phase:

- leaderboard/table rows should support the user's selected avatar beside the name;
- selected avatar glow/aura should also be representable beside the name where appropriate;
- comparable statistics may use tables and tabs where required for clarity;
- competition remains lightweight, clean and performance-focused, with no social feed or vanity mechanics.

No Group/Team database or UI work is introduced by Phase 4.

## Proposed Phase 4 implementation sequence

- **Stage 0 — complete:** production baseline; analysis/causation contracts; interval semantics; incomplete-data ladder; consistency and focus rules; Group/Team boundary.
- **Stage 1:** Session historical Development-Tag snapshot hardening + pure Assessment-pair / relevant-training evidence engine.
- **Stage 2:** incomplete-data evidence summaries + observed structured-training consistency engine.
- **Stage 3:** underrepresented related-Session detection + deterministic possible-next-focus engine.
- **Stage 4:** combined Assessment Analysis engine/view-model with test-level and overall cautious narratives.
- **Stage 5:** Progress UI integration, deliberate 0/1/2+ states, responsive dark-first analysis presentation.
- **Stage 6:** regression/edge-case hardening, information-density and causation-language audit.
- **Stage 7:** final release gate, merge to `main`, production deployment and post-deploy verification.

## Stage 0 acceptance gate

Stage 1 must preserve all of the following:

- no fake Wilf/Xander Session or Assessment history;
- no rewrite of the 499 legacy workout logs;
- protected Paul/Wilf/Xander plan fingerprints unchanged;
- no Phase 4 relational database summary model;
- no cross-Assessment-template comparison;
- no incompatible metric comparison;
- no legacy workout reverse-classification into Sessions/Development Tags;
- no causal language;
- no formal plan-adherence claim from incomplete historical plan data;
- no leaderboard/monthly-award/Group-Team implementation inside Phase 4.