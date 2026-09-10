# Phase 3 Progress Dashboard — Stage 3 Development Trend Engine

Status: complete on `feature/phase3-progress-dashboard`.

Stage 3 adds the pure Development Trend aggregation layer defined in the Phase 3 Stage 0 contract. It introduces no database schema, production history, weekly-plan mutation, navigation/UI change, XP rule, badge rule or Phase 4 causal analysis.

## Objective

Stage 3 turns immutable Assessment Test history into higher-level Development Tag signals such as:

- Acceleration;
- First Touch;
- Weak Foot;
- Strength;
- Mobility;
- other future generic Development Tags.

It uses the shared Development Tag architecture already established across Sessions and Assessments. No Assessment-only trend taxonomy is created.

## New files

- `src/engine/progressDevelopmentTrendEngine.js`
- `src/engine/progressDevelopmentTrendEngine.test.js`

The engine composes:

- `progressAssessmentEngine` for correctly scoped completed Assessment history;
- `assessmentHistoryEngine` for immutable Test history and metric-compatibility rules;
- the existing `development_tags` definitions;
- the existing `test_development_tags` relationships.

No database view/cache/history table is added.

## Public API

### `buildDevelopmentTestTrend(history)`

Builds one canonical Test's recent Development Trend signal from Assessment Test history.

Output includes:

- Test identity/name;
- total historical result count;
- current compatible-metric history count;
- latest result date;
- current metric key;
- state;
- normalized directional trend score;
- normal/strong directional strength;
- recent comparison count;
- normalized percentage improvement only when percentage-safe;
- latest comparison detail;
- recent comparison details.

### `buildDevelopmentTrendsFromAssessmentProgress(...)`

Accepts an already-built Assessment Progress model plus shared Development Tags and Test/Tag relationships.

This is the intended composition point for the later Progress view-model/UI, avoiding duplicate Assessment-history work.

### `buildDevelopmentTrends(...)`

Convenience wrapper that accepts raw runs/results plus optional profile/Assessment-Template scope, builds Assessment Progress first, then builds Development Trends.

## Early-data state contract

Stage 3 implements the Phase 3 Stage 0 state matrix directly:

### No compatible result

`no_baseline`

No trend claim is made.

### One compatible result

`baseline_set`

The Test/Tag has a baseline but no direction yet.

### Two compatible results

Latest vs previous produces the first directional signal.

Possible states:

- `improving`;
- `declining`;
- `unchanged`;
- `mixed`.

### Three or more compatible results

The trend uses the latest three compatible points, producing the latest two adjacent comparisons.

This keeps the signal recent without allowing very old history to dominate. Older history remains available in Assessment/Test history and later charts, but it does not indefinitely outweigh recent direction.

## Metric compatibility protection

Development Trend history uses the latest contiguous compatible metric cohort only.

If a Test's metric contract changes materially, for example:

- unit;
- scoring meaning;
- side mode;
- comparison meaning;

then old incompatible measurements are not connected into one trend.

The new metric cohort starts again at:

`baseline_set`

until a second compatible result exists.

This follows the existing Assessment metric/history compatibility engine rather than inventing separate Stage 3 rules.

## Direction normalization

Stage 3 never averages raw seconds, repetitions, centimetres or other physical units together.

Instead, each comparable Test dimension is converted to normalized directional evidence:

- improved = `+1`;
- unchanged = `0`;
- declined = `-1`.

The existing metric engine decides what improved/declined means, so lower-is-better metrics such as sprint time are handled correctly.

### Bilateral Tests

For left/right Tests, the two dimensions are normalized inside the canonical Test first.

Example:

- left improves;
- right declines;

The Test is `mixed` with a neutral directional score rather than being counted as two separate Tests.

This ensures a bilateral Test does not receive double weight merely because it has two measured sides.

## Multi-Test Development Tag aggregation

A Development Tag may contain more than one Test.

Stage 3 gives each canonical Test equal directional weight after its own metric/dimension normalization.

Therefore:

- a +10-rep change cannot numerically overpower a -0.1-second change merely because `10 > 0.1`;
- one Test improving and another declining may correctly produce `mixed`;
- multiple aligned improving Tests reinforce the tag direction;
- baseline-only Tests do not invent directional evidence.

## Percentage rules

Safe percentage improvement is retained only as a normalized secondary measure.

A Test percentage is available only when every contributing recent comparison/dimension is percentage-safe according to the Assessment metric engine.

A Development Tag percentage is available only when every contributing comparison-ready Test is percentage-safe.

If any contributing Test is percentage-unsafe, for example signed toe-touch flexibility around zero, the tag can still say `improving`/`declining`, but its aggregated percentage is `null` rather than misleading.

Raw-unit averaging is never exposed.

## Trend strength

Directional strength is intentionally simple for the later UI:

### Test level

- one directional comparison = `normal`;
- two consecutive recent comparisons in the same direction = `strong`.

### Development Tag level

A directional tag is `strong` when:

- at least two comparison-ready Tests align in the same direction with no conflict; or
- one Test is the only comparison-ready Test and that Test itself has a sustained strong recent trend.

This supports later UI semantics such as a single or double arrow without inventing a complex proprietary performance score.

## Mixed evidence preservation

The first Stage 3 permanent CI run exposed an important edge case.

A bilateral Test with one side improving and the other declining produced a normalized numeric score of zero. At the higher Test/Tag layer, a zero score was initially being interpreted as `unchanged`, losing the fact that the underlying evidence was genuinely mixed.

Stage 3 now preserves semantic state as well as numeric direction:

- true unchanged evidence remains `unchanged`;
- opposing evidence that cancels numerically remains `mixed`.

The correction is regression-tested at both Test and Development Tag level.

## Shared Development Tag contract

Stage 3 consumes the existing Assessment library shapes already returned by:

- `listAssessmentDevelopmentTags(...)`;
- `listTestDevelopmentTags(...)`.

Both snake_case database relationships and camelCase application relationship objects are accepted by the pure engine.

Duplicate Test/Tag relationship rows are defensively deduplicated.

A relationship to a Development Tag definition not supplied to the engine is ignored rather than inventing a tag.

## Profile/template isolation

`buildDevelopmentTrends(...)` delegates profile and optional Assessment-Template scoping to the Stage 2 Assessment Progress engine.

Automated coverage proves another athlete's results cannot alter the selected athlete's Development Trend.

## Automated verification

Feature code head after the mixed-evidence correction:

`34a84dbbe84e3ea6839457ca8d0a702dfd8af779`

Permanent PR gate:

- Workout Tracker CI run #273 / ID `34451675490`: success;
- test step: success;
- production build step: success;
- security audit step: success;
- Vercel preview on exact feature head: success.

Stage 3 adds 18 dedicated tests.

With the Stage 2 baseline of 339 tests across 31 files, the Stage 3 branch now contains 357 tests across 32 test files.

The Stage 3 suite covers:

- no-baseline mapped-tag state;
- one-result baseline state;
- higher-is-better direction;
- lower-is-better direction;
- true unchanged results;
- bilateral mixed direction;
- sustained three-point improving trends;
- latest-three-point recency behavior;
- cancelling recent evidence;
- equal canonical-Test weighting across unlike raw units;
- safe cross-unit normalized percentage aggregation;
- percentage-unsafe tag protection;
- metric-change baseline reset;
- profile isolation;
- duplicate relationship deduplication;
- missing-tag relationship protection;
- direct aggregation from Stage 2 Assessment Progress;
- pure per-Test builder reuse.

## Live production safety verification

Stage 3 performs no database writes.

After the successful Stage 3 code gate, live Supabase still reports:

- workout logs: 499;
- Assessment runs: 0;
- completed Assessments: 0;
- Assessment Test results: 0;
- active recurring Assessment schedules: 2;
- active shared Development Tags: 10;
- Test/Development-Tag links: 48.

Protected profile plan fingerprints remain exactly:

- Paul: `a715c519932be388cebe88722439de8b`;
- Wilf: `278e036e425e2eeff7b02b417029403f`;
- Xander: `b3b95dc0668da96dfcfeccdea21b6cfe`.

No fake Wilf/Xander Assessment results were created.

## Phase 4 boundary remains intact

Stage 3 can truthfully say things such as:

- Acceleration improving;
- First Touch unchanged;
- Strength mixed;
- Mobility baseline set.

It does not say:

- a specific training Session caused the change;
- recorded repetitions caused the change;
- a missing Session explains a decline;
- the athlete should train a particular area next.

Those training-to-testing interpretations remain Phase 4 Analysis.

## Stage 3 acceptance

Stage 3 is complete when:

- Development Trends are grouped through shared Development Tags;
- raw incompatible units are never averaged;
- metric changes cannot bridge incompatible trend history;
- bilateral Tests cannot double-weight a tag;
- mixed evidence remains mixed;
- 0/1/2/3+ data states are deterministic;
- profile isolation is preserved;
- full tests/build/audit are green;
- production history/plans remain unchanged.

All acceptance conditions are satisfied.

Next: Phase 3 / Stage 4 — Progress UI shell, deliberate 0/1/2/3+ empty/early-data states, and guarded `Stats` → `Progress` navigation evolution without removing legacy Stats functionality before parity is proven.
