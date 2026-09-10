# Phase 4 Analysis — Stage 5 Progress UI Integration

Status: Stage 5 complete pending the clean documented-head closure gate. This stage adds the visible Assessment Analysis experience to the existing Progress destination. It does not add a new top-level tab, database table, API endpoint or persistence write.

## Objective

Stage 5 turns the deterministic Stage 4 Assessment Analysis engine/view-model into a usable Progress experience while preserving the truth boundaries established in Stages 0–4.

The UI must make Analysis useful at all current history depths:

- zero completed Assessments: explain that a baseline is required;
- one completed Assessment: show that the baseline is established and that the same Assessment Template must be completed again;
- two or more compatible same-template Assessments: show between-benchmark Analysis.

No empty-state percentage, Session count, recommendation or PB is fabricated.

## Placement and data flow

Assessment Analysis extends the existing `Progress` destination.

Released hierarchy after Stage 5:

`Progress`
→ Training
→ Session Distribution
→ Movement Totals
→ Assessments
→ Development Trends
→ **Assessment Analysis**
→ retained legacy workout Stats compatibility layer

`ProgressDashboard.jsx` continues to use its existing five remote source loads:

- `loadSessionLibrary(...)`;
- `loadAssessmentLibrary(...)`;
- `loadCompletedAssessmentHistory(...)`;
- `listAssessmentRuns(...)`;
- `listAssessmentSchedules(...)`.

Stage 5 adds no sixth Analysis fetch. The existing Session/Assessment libraries, completed Assessment history and supplied workout logs are passed through:

`buildAssessmentAnalysis(...)`
→ `buildAssessmentAnalysisViewModel(...)`
→ `AssessmentAnalysisProgress`.

React remains presentation-only. Comparison, PB, evidence, consistency, underrepresentation and possible-focus truth stays in the pure engine/view-model layers.

## Deliberate history states

### 0 Assessments — `no_baseline`

The Analysis section keeps the stable heading `Assessment Analysis` and shows:

- `0 BENCHMARKS`;
- `Build your Assessment baseline`;
- an explanation that a benchmark is required;
- an `Open Assess` action when the parent callback is available.

No comparison cards, observed-consistency percentage, Session imbalance or Test analysis appears.

### 1 Assessment — `baseline_only`

The section shows:

- `1 BENCHMARK`;
- `Baseline established`;
- the completed baseline date;
- guidance to complete the same Assessment Template again.

No fake latest-vs-previous comparison metrics are shown.

### 2+ compatible Assessments — `analysis_ready`

The full Analysis experience appears.

## Ready-state presentation

### Benchmark strip

Shows previous Assessment date, latest Assessment date and the strict calendar interval between them.

The Analysis engine continues to exclude both Assessment dates from between-benchmark training aggregation because workout logs do not prove activity ordering within the Assessment day.

### Outcome summary

Six compact cards present existing Assessment truth:

- New PBs;
- Improved;
- Declined;
- Unchanged;
- Mixed;
- No compatible comparison.

PB gold and improvement/caution tones use the same semantic colour roles as the wider Progress system.

### Between-benchmark summary

The deterministic Stage 4 overall narrative is displayed directly. React does not generate or rewrite it.

### Training context

The section shows:

- completed structured Sessions;
- completed structured Session days;
- observed structured-training consistency.

The consistency note is permanently visible and states that this is a recorded training-rhythm measure, not formal plan adherence.

### Assessment-relevant Session balance

Only active Session Templates connected to the selected Assessment through Development Tags are listed.

Rows expose completed counts and genuine underrepresentation. Zero-count relevant Sessions can remain visible.

Where the Stage 3 rule produces a possible focus, the UI explains the recorded imbalance and explicitly says:

`Based on recorded Session balance only — not an automatic load prescription.`

When Session evidence is balanced or insufficient, the UI shows `No automatic focus suggested` rather than manufacturing a recommendation.

### Evidence quality

A compact panel counts Tests with:

- High detail;
- Medium detail;
- Limited detail;
- No related structured evidence.

If an older Session/Test relationship had to use current Development Tag taxonomy because a frozen tag list was unavailable, the fallback provenance is visible.

### Test-by-Test Analysis

Each Test is rendered as a collapsed `<details>` row by default to prevent a full Assessment from turning Progress into an excessively long feed.

The closed row keeps the highest-value scan information visible:

- Test name;
- previous → latest display value;
- safe percentage improvement where available;
- PB marker;
- outcome state;
- evidence-detail level.

Expanding a row exposes:

- deterministic Test narrative;
- original baseline value;
- completed/partial related Session evidence;
- typed volume facts such as recorded executions or attempts/successes;
- metric-change note where required;
- taxonomy-fallback note where required.

Unlike measurements are never combined into a synthetic volume figure.

## Causation boundary

The visible Analysis section ends with the permanent interpretation boundary:

`Analysis describes recorded training alongside benchmark change; it does not establish that training caused the result.`

The possible-focus copy is also explicitly non-prescriptive. Stage 5 does not tell an athlete to increase load, weight, sprint volume, repetitions or training frequency.

## Information-density decision

Stage 5 intentionally keeps:

- outcome cards compact;
- training context in three high-value cards;
- Session balance and evidence quality side by side on wide screens;
- individual Test evidence collapsed until requested.

This preserves immediate performance visibility without making Analysis behave like a social feed or a long report.

## Brand and responsive contract

`AssessmentAnalysisProgress.css` is scoped to the Analysis section and follows the Workout Tracker dark-first palette:

- background `#0F1117`;
- interaction cyan `#00E5FF`;
- progress/improvement green `#00FF88`;
- PB/prestige gold `#FFD700`;
- caution/decline red `#FF4D4D`;
- muted border grey `#2A2D36`.

Responsive rules are provided at 980 px, 700 px and 480 px. Wide two-column Session/evidence layout collapses to one column, summary/training cards reduce in columns, Test chips stack safely, and mobile actions expand to usable width.

A `prefers-reduced-motion` rule minimizes transition/animation duration.

## Stage 5 tests

New/updated Stage 5 coverage verifies:

- zero-Assessment state;
- baseline-only state;
- full analysis-ready state;
- `Open Assess` callback;
- Session focus and balanced no-focus behavior;
- taxonomy provenance visibility;
- expandable Test evidence;
- duplicate narrative/fact representations are intentional;
- Analysis uses the same existing Progress remote sources and does not add another API call;
- production empty-history state remains deliberate;
- Analysis renders after Development Trends and before the retained legacy Stats bridge;
- dark-first brand tokens, responsive breakpoints and reduced-motion contract;
- Test evidence remains collapsed by default for information density.

The initial Stage 5 gates exposed only presentation-test ambiguity: labels/dates that legitimately appear in more than one Progress panel and typed facts that intentionally also appear in the readable narrative. Tests were scoped to their semantic containers rather than deleting useful UI information. The empty-state heading was also improved so `Assessment Analysis` remains the stable section heading while `Build your Assessment baseline` appears only inside the state card.

Green Stage 5 feature-code gate before temporary-file cleanup:

- permanent CI run #383 (`34475573852`): success;
- 56/56 test files;
- 479/479 tests;
- Vite 8.2.2 production build: success;
- 680 modules transformed;
- npm audit: 0 vulnerabilities;
- exact feature-head Vercel status: success.

## Bundle-size signal for Stage 6

The Stage 5 production build reports the main app JS chunk at approximately 514.13 kB minified / 127.33 kB gzip and therefore crosses Vite's 500 kB warning threshold.

This is a non-blocking build warning, not a failed release gate. Stage 6 must explicitly review bundle/density performance and decide whether Analysis or other heavy Progress code should be code-split/lazy-loaded rather than silently increasing the warning threshold.

## Persistence and production safety

Stage 5 introduces no database/schema write and no new persistence model.

It does not:

- backfill Session history;
- create fake Assessment history;
- rewrite legacy workout logs;
- alter weekly plans;
- change Assessment schedules;
- create leaderboard/group data.

The only Phase 4 persistence-shape change remains the forward-only Session schema v2 Movement Development Tag snapshot hardening introduced in Stage 1.

## Temporary integration mechanics

Because Progress integration was guarded against source drift, Stage 5 briefly used branch-only files:

- `.github/workflows/phase4-stage5-integrate.yml`;
- `scripts/phase4-stage5-integrate.py`.

Both are removed before the clean documented Stage 5 closure head.

## Next stage

Stage 6 is the Phase 4 hardening stage:

- causation-language audit across all engine/UI paths;
- unusual Assessment/Test/evidence edge cases;
- information-density and responsive review;
- bundle-size/code-splitting review prompted by the Stage 5 Vite warning;
- full Phase 1–4 regression protection before the Stage 7 release gate.

Group/Team leaderboards and monthly awards remain intentionally outside Phase 4 and are still the planned next product build after Phase 4 release.
