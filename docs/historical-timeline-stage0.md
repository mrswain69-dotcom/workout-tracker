# Historical Timeline / Performance Autobiography — Stage 0 Baseline & Architecture

Status: Stage 0 complete on the Historical Timeline feature branch. This stage locks the truth, age, privacy, source-of-truth, milestone and Career Summary contracts before implementation. No production workout history, plans, Assessments, Group history or XP are rewritten.

## Objective

The Future Expansion Roadmap defines the Historical Timeline as a high-emotional-value differentiator:

- age-based history (`Age 10`, `Age 11`, `Age 12`, ...);
- strength trends;
- cardio trends;
- knowledge milestones;
- season wins;
- improvement spikes;
- eventually a Career Summary containing total Sessions, highest streak, biggest improvement year and lifetime improvement context.

The Master Doctrine describes the same destination as a **performance autobiography**: a long-term record of growth rather than another short-window dashboard.

This phase builds that autobiography from evidence Workout Tracker actually owns. It must never invent an age, backfill a result that was not recorded, or collapse unlike performance metrics into a fake universal score.

## Stage 0 production baseline

Repository: `mrswain69-dotcom/workout-tracker`

- base branch: `main`;
- base production commit: `37e27245d491a90e08517dc90faeab1122170f3b`;
- Group & Team Ecosystem: production released;
- Progress / Assessment Analysis: production released;
- permanent CI immediately before this phase: 89 test files / 644 tests;
- Vite production build: 706 modules;
- npm audit: 0 vulnerabilities.

Live Supabase project: `chdoyavyydwaewpuzbsb`.

Protected live baseline at Stage 0:

- workout-log rows: **499**;
- completed Assessment runs: **0**;
- Assessment Test result rows: **0**;
- Consistency schedule snapshots: **5**;
- frozen Group Progress Awards: **0**;
- active athlete profiles: **3**.

Current historical coverage:

- Paul: 152 log rows, `2026-01-06` → `2026-08-31`;
- Wilf: 161 log rows, `2025-12-29` → `2026-08-11`;
- Xander: 186 log rows, `2025-12-29` → `2026-07-20`.

These 499 existing log rows are protected historical source data. This phase does not rewrite them to manufacture newer Session formats or retrospective metadata.

## Critical age-data finding

The current `profiles` table has an `age_group` field whose live values are `adult` and `under16`.

It does **not** store a date of birth.

Therefore the roadmap's true age chapters cannot currently be calculated. Calendar year is not a valid substitute: a user may have two different ages during the same calendar year.

### Locked age contract

Stage 1 will introduce a nullable, family-private `birth_date` on the athlete profile.

Rules:

1. `birth_date` is optional until the family supplies it.
2. Age for a historical event is the integer age actually reached on that event's calendar date.
3. No event is assigned to an `Age N` chapter without a valid `birth_date`.
4. If `birth_date` is absent, the UI uses a deliberate `Age timeline unavailable` state while still allowing date-based history where appropriate.
5. `age_group` is **not** used to infer an exact age.
6. No production profile receives a guessed or memory-derived date of birth.
7. Editing `birth_date` may regroup timeline presentation, but never rewrites the underlying workout / Assessment / award source rows.

### Child privacy contract

`birth_date` is private family/profile data.

It must never be exposed through:

- Group membership identity;
- Group leaderboards;
- Group challenges;
- Squad / Club views;
- Group PR Boards;
- public nickname/avatar payloads.

Group-facing identity remains the existing safe nickname/avatar/frame contract. Historical Timeline is an own-family/private athlete surface.

## Historical source hierarchy

The autobiography is an evidence view over existing immutable or reproducible sources. It is not a second performance database.

### 1. Workout logs

`logs.date_ymd` supplies the historical day. `log_json` supplies recorded workout facts.

Rules:

- legacy workouts stay legacy workouts;
- structured Session snapshots keep their frozen Session / Movement identities;
- legacy workouts are not reverse-labelled as Session A/B/C;
- missing repetitions, duration, load, distance or completion detail are not invented;
- a historical plan does not prove that an activity was performed.

The existing Session / Progress engines remain authoritative for structured Session meaning.

### 2. Assessments

Only completed, valid Assessment history may create benchmark / PB / Development Trend timeline evidence.

The existing Assessment Metric, History, Progress and Development Trend engines remain authoritative for:

- compatible metric comparison;
- baseline / latest / PB semantics;
- higher-is-better versus lower-is-better direction;
- percentage-safe versus absolute-only changes;
- Development Tag trends.

No second comparison engine is introduced for the timeline.

Production currently has zero Assessment history, so Assessment timeline sections must have a truthful empty state until real results exist.

### 3. Group / season awards

Historical season wins / progress awards come only from frozen server-authoritative award records such as `group_progress_awards`.

Rules:

- current/live leaderboard position is not retrospectively called a season win;
- only a frozen completed-period award can become a permanent historical milestone;
- Group history exposed inside an athlete's autobiography may include the athlete's own award, period and safe Group display context, but never another family's private profile data.

Production currently has zero frozen Group Progress Awards, so no season win is fabricated.

### 4. Consistency history

The five existing Consistency schedule snapshots are forward-looking historical authority from their effective dates onward.

Timeline consistency must respect snapshot effective dates and may not reconstruct a formal planned-day denominator for periods that predate reliable schedule snapshots.

No current plan is projected backwards onto old workout dates.

### 5. Knowledge milestones

The roadmap includes Knowledge milestones, but the Body Intelligence system is not yet a production historical source in the current app.

Therefore initial Historical Timeline releases must expose Knowledge as `not available yet`, not generate milestones from ordinary Tasks or infer learning from workout text.

When Body Intelligence is implemented later, it may register dated immutable/reproducible milestone evidence that plugs into the same Timeline event contract.

## Timeline event contract

Every item shown as a historical milestone/event must have:

- `profileId` — the athlete whose history owns the event;
- `date` — a real source date;
- `sourceType` — e.g. workout, session, assessment, group_award, consistency, future knowledge;
- `sourceId` / stable source key where available;
- `eventType` — a controlled type, not arbitrary generated prose;
- `title` — concise presentation label;
- `evidence` — typed supporting values/metadata;
- `age` — derived from `birth_date` + event date, or `null` when unavailable;
- `confidence` / evidence state where source completeness varies;
- deterministic sort identity for same-day events.

Event extraction is deterministic. An AI layer may eventually reword summaries but may not decide whether an event happened.

## Age chapter contract

Once a valid `birth_date` exists, events are partitioned by actual attained age.

For example, if an athlete turns 12 on 15 December:

- 14 December events belong to Age 11;
- 15 December and later events belong to Age 12.

An age chapter may expose:

- date range covered by recorded evidence;
- training summary;
- strength evidence/trends;
- cardio evidence/trends;
- Assessment benchmarks/PBs;
- improvement highlights;
- Consistency highlights where historically supported;
- frozen season / progress awards;
- future Knowledge milestones.

A chapter is not required to contain every category. Missing evidence produces an honest empty/insufficient-data state.

## Strength-trend contract

Strength is not one universal number.

The timeline may show trends only within comparable movement / metric histories supported by existing Workout Tracker rules.

Allowed examples:

- bodyweight push-up repetitions over time;
- comparable squat load/reps history where the existing comparison rules consider the performances compatible;
- Assessment strength Test progression;
- genuine PR dates.

Disallowed:

- adding kilograms + repetitions into one score;
- saying `strength improved 18%` by averaging unrelated exercises without a defined, tested normalization contract;
- treating a changed exercise variation as directly comparable when existing rules do not.

## Cardio-trend contract

Cardio history also remains metric-specific.

Allowed evidence includes comparable recorded duration, distance, pace/time or Assessment cardio metrics when the existing engines can compare them truthfully.

Unlike units are never summed into a synthetic cardio score.

## Improvement-spike contract

An `improvement spike` is a presentation highlight derived from existing valid comparison evidence, not a new scoring economy.

Initial rules:

- only compatible before/after evidence may qualify;
- percentage change is used only when the underlying metric engine says percentage comparison is safe;
- otherwise absolute change is retained;
- PB events may qualify as highlights;
- no spike is inferred from XP, total volume or a changed metric alone;
- no causal wording attributes the change to a particular workout or plan.

The timeline can say `largest recorded improvement in this period`; it cannot say `this training caused the jump`.

## Season-win contract

A `season win` requires a frozen completed season result/award from the Group & Team authority.

A live Top 3 position, unfinished season, or deleted test fixture does not become autobiography history.

Where an athlete has multiple genuine awards in a period, the timeline preserves distinct award types (XP / Consistency / Improvement / Finisher etc.) rather than inventing a combined MVP score.

## Career Summary contract

The roadmap's Career Summary is intended after **3+ years** of real history.

Until the available evidence span reaches three years, the Career Summary may show a progress-to-unlock state rather than pretending the athlete has a career-scale record.

### Safe initial Career Summary fields

- total genuine recorded training Sessions/workout days, with legacy-vs-structured distinction available in detail;
- highest historically supportable streak according to the canonical streak rules/evidence available for that period;
- number of genuine PB / improvement milestones;
- years / ages covered;
- frozen season/progress awards won.

### Biggest improvement year

This can be selected only from comparable improvement events using one locked deterministic method. Stage 4/5 will define and test the exact ranking rule before UI release.

### `Total improvement % lifetime`

The roadmap names this aspiration, but the current system contains heterogeneous metrics (seconds, repetitions, kilograms, attempts/successes, scores, distances).

Stage 0 explicitly forbids summing or averaging unlike percentage changes into a fake lifetime percentage.

The UI must therefore either:

- show metric-specific lifetime improvements; or
- wait until a separately specified, mathematically defensible normalization model exists.

Integrity takes priority over filling a card.

## Mutation / correction semantics

The autobiography reflects the current truth of historical source records.

- Deleting/correcting a historical workout or Assessment may change derived timeline events.
- A past earned-looking event is not permanently cached if its source evidence no longer exists.
- Frozen Group awards remain authoritative records unless explicitly revoked/deleted by the existing Group authority.
- Timeline-derived output itself does not grant XP, badges, challenge credit or leaderboard score.

This matches Workout Tracker's existing principle that derived history should reflect genuine source history rather than an irreversible claim ledger.

## Placement and navigation

The current production mobile primary navigation is locked as:

`Log | Progress | Rewards`

The Historical Timeline will **not** add a fourth primary mobile tab.

Initial placement is inside `Progress`, as a long-range History / Timeline surface alongside the existing Training and Assessment evidence.

The Brand System's future `Profile` autobiography concept remains compatible: if Workout Tracker later introduces a dedicated Profile destination, this same timeline view-model can be surfaced there without changing its truth engine.

## Database architecture decision

Stage 0 does not add a timeline-summary table.

Initial source-of-truth remains the existing records listed above. Derived timeline / chapter models are calculated through pure/testable application engines.

The only new persistence required by the locked Stage 1 plan is the private nullable profile `birth_date` needed to assign real historical age chapters.

No 499-log backfill is required.

## Proposed implementation sequence

- **Stage 0 — complete:** production baseline; age/privacy contract; historical source hierarchy; Timeline event contract; trend/spike/season/Career Summary truth rules; navigation boundary.
- **Stage 1:** private nullable `birth_date` profile foundation + family-only database/RLS verification + age-on-date primitives + profile editing support.
- **Stage 2:** pure Historical Event Engine extracting typed workout/Session, Assessment and frozen award events without rewriting history.
- **Stage 3:** Age Chapter Engine + strength/cardio evidence summaries + improvement highlight selection + deliberate incomplete-data states.
- **Stage 4:** long-range milestone composition: Consistency evidence, Group/season awards and future-proof Knowledge milestone adapter; Career Summary foundation and 3-year gate.
- **Stage 5:** Progress integration and Performance Autobiography UI: age selector/timeline, chapter summary, milestone feed, evidence drill-down and responsive dark-first design.
- **Stage 6:** historical correction semantics, same-day ordering, leap-day/birthday boundaries, legacy/structured coexistence, privacy and information-density hardening.
- **Stage 7:** final full regression/security gate, production release, post-deploy database/history verification.

## Stage 0 acceptance gate

Stage 1 and all later stages must preserve these non-negotiables:

- no guessed dates of birth;
- no exact-age derivation from `under16` / `adult`;
- no rewrite/backfill of the 499 historical logs;
- no fake Assessment history (production baseline is zero);
- no fake frozen Group awards (production baseline is zero);
- no current-plan projection backwards into old history;
- no reverse-classification of legacy workouts as modern Sessions;
- no incompatible metric aggregation;
- no synthetic universal strength/cardio/lifetime-improvement score;
- no causal claim from correlation;
- no Timeline-derived XP/leaderboard/badge inflation;
- no birth date or private profile detail exposed through Groups;
- no new primary mobile navigation tab;
- Knowledge milestones stay unavailable until a genuine Knowledge history source exists;
- Career Summary remains gated until enough real history exists.
