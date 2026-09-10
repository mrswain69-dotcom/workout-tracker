# Phase 3 / Stage 6 — Assessment Charts & Detailed Development Trends UI

## Status

Stage 6 is complete at the feature-code gate. This stage adds the detailed benchmark and Development visual layer on top of the Stage 2 Assessment Progress engine and Stage 3 Development Trend engine. It does not change database schema, Assessment scoring semantics, Session history, weekly plans, rewards, or Phase 4 analysis boundaries.

## Scope

Stage 6 delivers:

- detailed latest-benchmark status summaries;
- genuine PB visibility after comparable history exists;
- per-Test Assessment history cards and charts;
- separate bilateral left/right chart series where the Test metric requires them;
- explicit higher-is-better / lower-is-better labelling;
- safe percentage-improvement highlights;
- absolute-only improvement visibility when a percentage is not mathematically safe;
- detailed Development Tag trend rows;
- linked Test trend rows inside each Development area;
- strong directional glyphs for sustained/aligned Stage 3 evidence;
- deliberate 0 / 1 / 2 / 3+ benchmark states throughout the UI.

Stage 6 intentionally does **not** add range/filter controls, final responsive/brand polish, legacy Stats removal, causal analysis, training recommendations, leaderboards, awards, or a Phase 3 database summary model. Those remain later-stage or Phase 4 work.

## Architecture

Stage 6 keeps the existing separation of truth and presentation:

```text
immutable completed Assessment history
        ↓
progressAssessmentEngine (Stage 2)
        ↓
progressAssessmentDetailViewModel (Stage 6)
        ↓
AssessmentProgressDetails
```

and:

```text
Assessment Test history + shared Development Tags
        ↓
progressDevelopmentTrendEngine (Stage 3)
        ↓
progressAssessmentDetailViewModel (Stage 6)
        ↓
DevelopmentTrendDetails
```

The new pure view-model is:

- `src/engine/progressAssessmentDetailViewModel.js`

The new UI is:

- `src/components/progress/AssessmentDevelopmentProgress.jsx`
- `src/components/progress/AssessmentDevelopmentProgress.css`

The existing `ProgressDashboard` only bridges the already-built `assessmentProgress` and `developmentTrends` objects into those detail components. Stage 5 training UI remains unchanged.

## Assessment history chart contract

### One Test = one metric axis

Every Assessment chart belongs to one canonical Test. Seconds, repetitions, centimetres, success rates and other unlike units are never plotted together on a shared performance axis.

The Test card shows the current metric unit/label plus either:

- `Higher is better`, or
- `Lower is better`.

This makes the direction of improvement explicit without requiring the athlete to infer it from the chart shape.

### Current compatible metric cohort only

A Test chart uses only the latest **contiguous compatible metric cohort**.

If a Test's metric contract changes, older incompatible points remain part of immutable history but are not connected to the new metric series. The card reports how many older points are retained outside the current chart.

A metric change therefore cannot create a false comparison or visually connect unlike measurement contracts.

### Baseline behaviour

The early-data contract is explicit:

- 0 completed Assessments → no baseline;
- 1 compatible result → Baseline only;
- 2 compatible results → genuine latest-vs-previous comparison and chart;
- 3+ compatible results → multi-point Test history while Stage 3 Development Trends use their locked recent-trend rules.

A one-point current-compatible cohort is always presented as `Baseline`, even if the lower-level comparison engine describes comparison availability as unavailable. This applies both to the athlete's first Assessment and to a Test whose metric contract has just changed.

No first result is presented as a PB or trend.

### Bilateral Tests

For a Test with `sideMode: separate`:

- left and right values remain separate chart series;
- left and right comparison chips are displayed separately;
- one side may improve while the other declines;
- that condition remains `Mixed` rather than being collapsed to unchanged.

This preserves the Stage 2 and Stage 3 bilateral semantics.

## Latest benchmark summary

Once genuine comparison history exists, Stage 6 shows latest-Test counts for:

- Improved;
- Declined;
- Unchanged;
- Mixed;
- No comparison;
- New PB events.

Before a second compatible benchmark, these directional cards are replaced by deliberate baseline guidance rather than a row of misleading zero comparisons.

PB counts remain genuine Stage 2 PB events. The first benchmark creates no fake PBs.

## Improvement highlights

Stage 6 preserves the Assessment metric engine's percentage-safety rules.

`Largest percentage-safe improvements` can rank only improvements whose percentage calculation is safe under the metric definition.

Improvements that are directionally valid but percentage-unsafe — for example signed/zero-crossing measurements — remain visible in a separate `Improved without safe cross-unit percentage` area. They are not assigned an invented percentage and are not ranked against percentage-safe Tests.

## Detailed Development Trends

Each shared Development Tag can now show:

- current state;
- directional glyph;
- linked Test count;
- observed Test count;
- comparison-ready Test count;
- latest benchmark date;
- normalized recent percentage only when the complete Tag evidence is percentage-safe;
- the linked Test trends that contributed to the Tag state.

### Direction glyphs

Stage 3 state is rendered as:

- `↑` improving;
- `↑↑` strong improving;
- `↓` declining;
- `↓↓` strong declining;
- `→` unchanged;
- `↕` mixed;
- `•` baseline set;
- `—` no baseline.

`Strong` does not mean a larger raw unit change. It retains the Stage 3 meaning: sustained/aligned recent compatible evidence.

### Percentage safety

A Development Tag displays a combined normalized recent percentage only when the Stage 3 engine marks the complete contributing evidence as percentage-safe.

If direction is valid but the Tag is not percentage-safe, the UI explicitly says that no combined percentage is shown. Raw seconds, reps and centimetres are never averaged together.

Individual linked Tests can still show their own safe normalized percentage when appropriate.

## Causal-analysis boundary

Stage 6 deliberately states the Phase 3 boundary in the Development UI:

> Development Trends summarize benchmark direction only.

The dashboard does not claim that a particular training Session caused a Test result and does not generate training recommendations. Causal interpretation remains Phase 4 work.

## Integration safety

The Stage 6 components are mounted inside the existing Progress destination:

- Assessment details render below the benchmark schedule;
- Development details render below the existing Development summary;
- Stage 5 Training cards/charts, Session Distribution and Movement totals remain intact;
- the legacy Stats bridge remains intact for the Stage 7 parity decision;
- the visible navigation still uses `Progress` over the existing internal `stats` route rather than adding a sixth main tab.

A temporary mechanical workflow/script was used only to patch the large `ProgressDashboard.jsx` safely. Both temporary files were removed immediately after integration.

## Tests

Stage 6 adds focused coverage for:

- compact chart date formatting;
- one-point baseline-only Test history;
- metric-change cohort reset;
- separate bilateral left/right chart dimensions;
- mixed bilateral status preservation;
- percentage-safe versus absolute-only improvement presentation;
- strong Development glyph mapping;
- Development Tag/Test percentage-safety boundaries;
- rendered Assessment summary/charts;
- rendered detailed Development Tags and linked Tests;
- full ProgressDashboard integration while retaining Stage 5 and the legacy Stats bridge;
- first-Assessment `Baseline` presentation even when comparison is unavailable;
- metric-reset one-point `Baseline` presentation.

The first isolated Stage 6 UI gate failed only because a test expected an exact sentence fragment as the entire DOM text node. The rendered product text was correct; the matcher was tightened to assert the supported phrase without changing product behaviour.

A later review identified a genuine presentation edge case before closure: Stage 2 correctly labels a first Test comparison as unavailable, but Stage 6 initially inherited that as `No comparison`. The detail view-model was corrected so a one-point current-compatible cohort always displays `Baseline`, and two dedicated regression tests now lock that behaviour.

## Verification

Feature-code gate head:

`ca19670e996b96642464026033986fd9fe10f931`

Permanent CI:

- run #310 / ID `34460715366`: success;
- 42 / 42 test files passed;
- 395 / 395 tests passed;
- Vite 8.2.2 production build passed;
- 670 modules transformed;
- `npm audit --audit-level=low`: 0 vulnerabilities;
- exact code-head Vercel preview: success.

Read-only live Supabase verification after the Stage 6 code gate:

- workout logs: 499;
- structured Session logs: 0;
- Assessment runs: 0;
- Assessment Test results: 0;
- active Assessment schedules: 2;
- active Development Tags: 10;
- Test/Development-Tag links: 48;
- Paul plan fingerprint: `a715c519932be388cebe88722439de8b`;
- Wilf plan fingerprint: `278e036e425e2eeff7b02b417029403f`;
- Xander plan fingerprint: `b3b95dc0668da96dfcfeccdea21b6cfe`.

No Stage 6 database writes, schema migrations, history rewrites or weekly-plan mutations were performed.

## Next

Phase 3 / Stage 7 is the final Progress-product refinement stage before the Phase 3 release gate:

- range/filter behaviour;
- responsive and brand polish;
- Progress information-density review;
- legacy Stats parity review and guarded removal/retention decision.

Stage 8 then performs the full regression, merge, production deployment and post-deployment verification.
