# Phase 3 Progress Dashboard — Stage 0 Baseline & Architecture

Status: Stage 0 complete; no production application logic, database schema, workout history, profile plans, Session history, Assessment history, XP, badges or schedules changed.

## Objective

Phase 3 implements the Progress Dashboard defined in the Workout Tracker development brief.

The brief requires a Progress area that connects:

- weekly training;
- monthly Assessment results;
- charts;
- Session balance;
- Movement totals.

The required dashboard content is:

### Training
- Sessions this week;
- Sessions this month;
- current streak;
- XP;
- total training time;
- recorded reps/executions.

### Session Distribution
Example: A × 5 / B × 4 / C × 2.

### Assessments
- latest Assessment date;
- number of PBs;
- biggest improvements;
- skills declining or unchanged.

### Development Trends
Examples from the brief include Acceleration, First Touch, Weak Foot, Flexibility and Upper-body strength.

Phase 3 does not introduce the Phase 4 analysis layer. It displays and aggregates truthful structured data; it does not claim training caused a Test improvement or prescribe the next training focus.

## Product / UX constraints

Workout Tracker remains:

- performance-first;
- family-first;
- clean and serious rather than toy-like;
- improvement-visible;
- generic/template-driven rather than football-specific.

Brand rules relevant to Phase 3:

- data must feel serious;
- improvement should be visible quickly;
- cyan = interaction;
- green = progress;
- gold = prestige/PB;
- red = caution only;
- avoid noisy or celebratory dashboard animation;
- family UX should motivate without overwhelming.

## Production baseline locked for Phase 3

Repository: `mrswain69-dotcom/workout-tracker`

- baseline branch: `main`
- baseline commit: `5b7c87595c45938f0da5c73dac9d647f02e61a7e`
- Phase 2 squash merge: `bed621b90a80eb63c4492ac9d38d405a72f82f04`
- production Vercel status: success
- permanent Workout Tracker CI on baseline: success
- current automated suite: 304 tests across 29 test files
- production build: Vite 8.2.2
- npm audit baseline: 0 vulnerabilities

Live Supabase project: `chdoyavyydwaewpuzbsb`.

Protected family baseline:

- workout logs: 499
- existing Phase 2 historical workout-log fingerprint retained as protected reference: `91b10f9431340a9f82c7aaa179974972`
- Paul plan fingerprint: `a715c519932be388cebe88722439de8b`
- Wilf plan fingerprint: `278e036e425e2eeff7b02b417029403f`
- Xander plan fingerprint: `b3b95dc0668da96dfcfeccdea21b6cfe`

Current structured definition state:

- Programmes: 1
- Movements: 15
- Session Templates: 3
- Session Template Movements: 17
- Development Tags: 10
- Movement/Development-Tag links: 44
- Assessment Templates: 1
- Tests: 20
- Assessment Template/Test memberships: 20
- Test/Development-Tag links: 48
- active recurring Assessment schedules: 2

Current structured history state:

- structured Session blocks stored in workout logs: 0
- completed structured Sessions: 0
- completed structured Session Movements: 0
- Session Movements with recorded structured result data: 0
- Assessment runs: 0
- completed Assessments: 0
- Assessment Test results: 0

This is an intentional empty-history baseline. Phase 3 must be fully usable before the boys create real structured history, without inserting fake Wilf/Xander records.

## Existing data contracts Phase 3 should reuse

### 1. Workout logs remain the source for daily training history

Existing `logs.log_json` records remain authoritative for legacy blocks and future structured Session snapshots.

Phase 3 must not rewrite the 499 legacy logs to make them look like Sessions.

Legacy workout history may continue to support broad existing metrics such as training days, XP/streak and existing block statistics, but a legacy workout must not be retrospectively counted as a structured Session A/B/C completion unless it actually contains a Session snapshot.

### 2. Phase 1 Session engine already provides reusable aggregation primitives

`src/engine/sessionEngine.js` already separates Session completion from Movement volume and exposes generic history functions including:

- `aggregateSessionHistory(...)`;
- `aggregateMovementHistory(...)`;
- `getSessionDistribution(...)`;
- `getRecommendedNextSession(...)`;
- recorded execution and attempts/successes helpers;
- Session training-minute helpers.

Phase 3 should compose these tested primitives instead of duplicating Session parsing in dashboard components.

### 3. Phase 2 Assessment history engine already provides reusable progress primitives

`src/engine/assessmentHistoryEngine.js` already derives completed Test history from immutable snapshots and provides:

- latest result;
- previous result;
- original baseline;
- PB state;
- previous/baseline comparisons;
- metric-compatibility safeguards;
- left/right history;
- completed Assessment run history.

Phase 3 should build summary/dashboard views from those outputs rather than reimplementing PB logic.

### 4. Shared Development Tags are the generic bridge

Training Movements and Assessment Tests already share the same generic Development Tag layer.

Phase 3 may aggregate Development-tag progress for display, but must not yet introduce Phase 4 causal analysis. A Development Trend can say that First Touch test performance is improving; it must not say that a particular amount of First Touch practice caused the improvement.

## Stage 0 architecture decision

Phase 3 should add a new pure application aggregation layer rather than another database history model.

Initial architecture:

`existing logs + Session engine + Assessment history + Development Tags + existing XP/streak state`

→ `Progress aggregation engine`

→ `Progress view-model`

→ `Progress UI`

No Phase 3 database table/view is required initially. Current family data volume is small and all required historical truth already exists in the Session/Assessment/log sources. A database summary/cache layer may be reconsidered later only if real scale or query performance justifies it.

The Progress aggregation engine must be pure/testable and must not live inside the already-large `App.jsx` stats memo.

## Main navigation decision

The current application already has a `Stats` area containing legacy statistics and a weekly chart.

Phase 3 should evolve that existing `Stats` destination into the new `Progress` area rather than adding a sixth main navigation tab.

Reasons:

- the brief asks for a Progress area rather than a parallel duplicate statistics product;
- the current mobile navigation already carries Log / Stats / Plan / Rewards / Assess;
- Progress subsumes the purpose of Stats;
- replacing/evolving Stats preserves a compact one-row athlete navigation.

Stage 0 makes no UI change; the rename/migration happens only after the new Progress UI is tested.

## Time-window contracts

Phase 3 should use explicit windows so cards/charts cannot silently disagree.

### This week
Monday 00:00 through Sunday 23:59 in the user's local calendar.

This matches the application's existing Monday-based `weekKey(...)` convention.

### This month
Current calendar month.

### Last 4 weeks
Rolling 28-day window ending on the selected/current date.

Use this as the default Session Balance window because the brief's Session Balance example is explicitly "Last 4 Weeks" and it matches the four-week Assessment cadence.

### Lifetime / All time
All available genuine history for the selected profile.

### Assessment comparison
Completed valid Assessment history only. In-progress/cancelled runs must not alter PB, previous or baseline summaries.

## Training metric contracts

### Sessions this week / month
Count only completed structured Session snapshots.

Do not count:

- a planned but unperformed Session;
- a partial Session as completed;
- a legacy workout as Session A/B/C merely because it contains similar exercises.

Partial Session activity may be shown separately later but must not inflate completion counts.

### Training days / legacy history
Existing broad workout history can remain visible as a separate training-day/workout concept where useful. It must not be relabelled as structured Session history.

### Total training time
Use truthful recorded/derived durations already supported by the existing engines.

For structured Sessions, use actual duration where captured and the existing Session duration fallback rules where appropriate. Do not invent minutes from repetition counts.

### Recorded reps / executions
Sum only explicit compatible recorded execution/repetition values.

Completion-only Movements contribute Session participation but contribute zero to recorded execution totals.

Attempts/successes should remain visible as attempts/successes rather than being silently converted into clean repetitions.

### Movement totals
Movement totals are grouped by canonical Movement identity and compatible tracking meaning.

Do not sum unlike measurements into one number (for example repetitions + seconds + kg + distance).

## Session Distribution contract

Default view: completed structured Sessions in the rolling last 28 days.

Each active/canonical Session Template receives its own count, including zero, so imbalance remains visible even when a Session has not been completed.

Historical snapshots retain their historical template identity/name; live template edits must not rewrite old Session records.

The dashboard can show the existing generic Recommended Next Session result, but prescriptive "focus next month" analysis remains Phase 4.

## Assessment dashboard contracts

### Latest Assessment date
Latest completed Assessment only.

If none exists, show the scheduled first benchmark/upcoming state rather than a fake date.

### PB count
For the main Assessment summary, count genuine new PB events in the latest completed Assessment relative to prior compatible history.

The first Assessment establishes a baseline and must not be presented as "20 new PBs" simply because it is the first recorded value.

For left/right Tests, a new left PB and right PB may be represented distinctly where the UI has room, but the counting rule must be explicit and tested.

### Biggest improvements
Available only after at least two compatible valid results.

Rank comparisons using a normalized improvement representation that respects higher-is-better/lower-is-better and the metric engine's percentage-safety rules. Signed/zero-crossing metrics must not be forced into misleading percentages.

### Declining / unchanged
Only classify after at least two compatible valid results.

A first baseline is neither improving nor declining.

"Unchanged" means an equal comparable result, not "no data".

## Development Trend contract

Development Trends are derived from Assessment Tests grouped through shared Development Tags.

Initial display states should remain intentionally simple:

- no completed Assessment: `No baseline yet`;
- one compatible result: `Baseline set`;
- two compatible results: directional latest-vs-previous status;
- three or more compatible results: recent trend may use multiple points rather than only the last comparison.

A tag can contain more than one Test. The later Development Trend engine must define deterministic aggregation and must not average incompatible physical units directly.

Preferred approach for Stage 3 is to aggregate direction/normalized change per Test, then summarize the tag rather than averaging raw seconds, reps and centimetres.

## Empty / early-data state matrix

Phase 3 must be designed around the real production state rather than assuming populated charts.

### 0 structured Sessions
Show a purposeful empty state such as "No structured Sessions logged yet" and keep scheduled plan/Assessment context visible. Do not backfill legacy logs as fake Sessions.

### 1 structured Session
Show the real count and distribution; do not invent a trend line.

### 2+ structured Sessions
Distribution and time-window comparisons become useful naturally.

### 0 completed Assessments
Show the recurring schedule/upcoming benchmark state. No PB/improvement/decline claims.

### 1 completed Assessment
Display baseline values and "Baseline established". PB-change and trend comparisons remain unavailable.

### 2 completed Assessments
Latest-vs-previous and latest-vs-baseline comparisons become available.

### 3+ completed Assessments
Trend charts and multi-point Development Trends become meaningful.

Automated UI/engine tests may use synthetic fixtures. Production Wilf/Xander history must remain genuine.

## Chart rules

- charts render no synthetic production datapoints;
- empty and one-point histories have deliberate states;
- incompatible Test metric versions must not share a continuous comparison/trend line;
- chart labels and values must retain units;
- lower-is-better metrics must not visually imply that a numerically rising value is improvement;
- left/right Tests keep distinct series;
- avoid chart overload on mobile;
- visual semantics follow the Brand & Experience System.

## Phase 4 boundary

Phase 3 may place truthful training and testing information next to each other, but it does not yet generate interpretations such as:

- "Your First Touch improved because you completed 186 repetitions";
- "Session C caused the improvement";
- "You should train X next month."

The brief assigns training-to-test interpretation, consistency analysis, missing/underrepresented Sessions and possible next focus to Phase 4.

Phase 3 must leave clean structured outputs for that later analysis layer.

## Existing legacy Stats migration boundary

`App.jsx` currently contains a legacy `stats` memo that calculates broad statistics and the existing weekly chart. It also calculates the current plan streak separately and already uses `buildBadgeStatsV2(...)` for other derived behavior/badge statistics.

Phase 3 should not grow this legacy memo further.

Instead:

1. create a pure `progressEngine` / progress view-model layer;
2. reuse existing trusted engines where possible;
3. gradually migrate only the values needed by the Progress UI;
4. keep existing Stats behavior available until replacement parity is proven;
5. remove/reduce legacy Stats code only in a later guarded cleanup after the new Progress area is green.

## Proposed Phase 3 implementation sequence

- Stage 0 — baseline, requirements, aggregation contracts, empty-state rules and Phase 4 boundary (complete)
- Stage 1 — pure Training Progress engine: time windows, Session counts, training time, recorded executions and Movement totals
- Stage 2 — Assessment Progress summary engine: latest Assessment, latest-run PBs, improvements, unchanged/declining classifications
- Stage 3 — Development Trend engine over shared Development Tags with incompatible-metric protection
- Stage 4 — Progress UI shell + deliberate 0/1/2/3+ data states; evolve `Stats` navigation into `Progress`
- Stage 5 — Training cards/charts, Session Distribution and Movement totals UI
- Stage 6 — Assessment cards/charts and Development Trends UI
- Stage 7 — range/filter polish, responsive/brand pass, regression coverage and legacy-Stats parity check
- Stage 8 — final Phase 3 regression, merge, production deployment and post-deploy verification

Phase 4 Analysis, weekly leaderboards and monthly awards remain explicitly out of Phase 3 scope.

## Stage 1 acceptance guard

Before Stage 1 is considered complete:

- no database schema change is required;
- no live data may be inserted to populate the dashboard;
- all aggregation must be profile-scoped;
- Session completion must remain distinct from Movement detail;
- legacy workout history must not be rewritten/reclassified;
- synthetic fixtures belong only in automated tests;
- the protected production baseline must remain intact:
  - 499 workout logs;
  - Paul plan `a715c519932be388cebe88722439de8b`;
  - Wilf plan `278e036e425e2eeff7b02b417029403f`;
  - Xander plan `b3b95dc0668da96dfcfeccdea21b6cfe`;
  - 0 structured Session blocks at this baseline;
  - 0 Assessment runs/results at this baseline.
