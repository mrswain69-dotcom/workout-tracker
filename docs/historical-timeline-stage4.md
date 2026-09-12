# Historical Timeline / Performance Autobiography — Stage 4 Long-Range Milestones & Career Summary Foundation

Status: Stage 4 implementation candidate on `feature/historical-performance-autobiography`.

## Objective

Stage 4 turns the Stage 2 event stream and Stage 3 age chapters into a long-range autobiography foundation without introducing a second scoring economy.

The locked roadmap goal remains:

- Consistency milestones where historical schedule authority exists;
- frozen Group / season achievements;
- future Knowledge milestones once a genuine source exists;
- a Career Summary after 3+ years of real history;
- no synthetic universal performance or lifetime-improvement score.

## Consistency authority

Consistency history is derived only through the canonical `consistencyEngine` and `profile_consistency_schedule_snapshots`.

Rules:

1. A schedule snapshot applies only from its `effective_date` forward.
2. No present-day plan is projected backwards.
3. A week/month whose full denominator cannot be supported by schedule snapshots is skipped rather than reconstructed.
4. Only historically completed periods are eligible.
5. Timeline milestone thresholds use the Rewards framework's existing 90% / 95% / 100% Consistency identity.
6. A Consistency milestone is derived evidence. It does not grant XP, badges, Group score or challenge credit.
7. Season-level competitive achievements remain the authority of frozen Group awards rather than a second individual season scorer.

Initial long-range events are:

- `consistency_week` for supported completed Monday–Sunday weeks at >=90%;
- `consistency_month` for supported completed calendar months at >=90%.

Each event retains planned days, completed days, exact percentage, threshold and Consistency score version.

## Frozen Group / season award composition

Stage 2 already accepts only frozen Group Progress Award rows.

Stage 4 preserves those records and gives controlled autobiography labels matching the existing Group season UI:

- Monthly XP Winner;
- Monthly Most Consistent;
- Monthly Most Improved;
- Season XP Champion;
- Season Consistency Champion;
- Season Improvement Champion;
- Season Finisher.

Award types stay distinct. There is no combined MVP score.

## Knowledge milestone adapter

Body Intelligence is still not a production historical source.

Therefore the default state remains:

`not_available_yet`

Stage 4 adds a deliberately opt-in adapter for future dated Knowledge records. It accepts only controlled event types:

- `knowledge_module_completed`;
- `knowledge_level_reached`;
- `knowledge_streak_milestone`;
- `knowledge_mastery_reached`.

The adapter produces no event unless the caller explicitly says a genuine Knowledge source is available. Ordinary Tasks, workout text and inferred learning never become Knowledge history.

## Autobiography foundation view-model

`historicalAutobiographyEngine` now provides one Stage 5-ready foundation by combining:

- Stage 2 base history events;
- Stage 4 supported Consistency milestones;
- frozen Group awards;
- optional genuine Knowledge milestones;
- Stage 3 age chapters/trend evidence;
- Career Summary foundation.

Age chapters are enriched with explicit:

- `consistency.state` + milestones;
- `knowledge.state` + milestones;
- frozen awards.

Consistency chapter states distinguish:

- `ready` — one or more supported milestone events;
- `no_milestone` — the period is historically supportable but did not hit a milestone threshold;
- `not_historically_supported` — the age chapter predates reliable schedule snapshots;
- `schedule_unavailable` — no historical schedule authority exists.

## Career Summary three-year gate

The roadmap says Career Summary appears after 3+ years.

Stage 4 defines this precisely:

- `firstEvidenceDate` = earliest genuine autobiography event;
- `lastEvidenceDate` = latest genuine autobiography event;
- `unlockDate` = first evidence date plus three full calendar years;
- the summary unlocks only when `lastEvidenceDate >= unlockDate`.

Elapsed account age is not enough. Three quiet years after one old workout do not create a three-year performance history.

Leap-day starts are clamped to the last valid day of the target month (`2024-02-29` -> `2027-02-28`).

## Career Summary fields

The Stage 4 foundation contains:

### Training history

- genuine recorded training days;
- structured Session total;
- completed structured Sessions;
- partial structured Sessions.

Training days and structured Sessions remain separate so modern Session records are not double-counted as extra legacy workouts.

### Highest workout streak

Stage 4 reuses `buildBadgeStatsV2` for the longest workout streak.

This intentionally keeps the autobiography aligned to the existing canonical green-day / Streak Saver rules rather than introducing another historical streak definition.

### Improvement milestones

The count comes from Stage 3's genuine comparable record/PB highlights.

No XP or volume event is treated as an improvement milestone.

### Biggest improvement year

Because unlike metrics cannot be averaged safely, Stage 4 defines `biggest improvement year` as:

1. calendar year with the most genuine improvement/PB milestones;
2. tie-break by the number of distinct comparable metrics represented;
3. if still tied, retain all tied years rather than inventing a winner.

The view-model exposes the method explicitly:

`improvement_milestone_count_then_distinct_metrics`

The UI should therefore phrase this as a milestone-based historical distinction, not as a claim that one year's aggregate physiology improved by a mathematically comparable percentage.

### Lifetime improvement

There is deliberately no universal lifetime improvement percentage.

The Career Summary returns:

- `universalPercentage: null`;
- `state: metric_specific_only`;
- metric-specific first-to-latest changes only within comparable series.

This preserves the Stage 0 integrity rule that kg, reps, seconds, scores and attempts/successes cannot be collapsed into a fake overall percentage.

### Frozen awards

Career Summary counts:

- all frozen progress awards;
- season awards;
- genuine season wins (XP / Consistency / Improvement champion);
- Season Finisher records separately.

## Privacy and mutation semantics

Stage 4 remains a private own-family view.

- `birth_date` is never exposed through Groups.
- The autobiography consumes the athlete's own source records.
- Frozen Group awards expose only the already-frozen own-athlete award record.
- Rebuilding the timeline after correcting/deleting a workout can change derived milestones.
- No timeline output writes back into XP, badge, Group or challenge authority.

## Production baseline impact

Stage 4 requires no database migration.

It does not rewrite:

- the 499 historical workout logs;
- Assessment history;
- Consistency schedule snapshots;
- Group awards;
- profile birth dates.

## Stage 4 acceptance gate

Stage 4 is complete only when permanent tests prove:

- supported Consistency periods can produce 90/95/100 milestones;
- periods before snapshot authority are not reconstructed;
- Knowledge remains unavailable by default;
- the future Knowledge adapter requires explicit genuine-source opt-in;
- age chapters receive Consistency/Knowledge milestones without changing Stage 3 truth rules;
- frozen award types remain distinct;
- Career Summary is locked before three full evidence years and available at/after the gate;
- leap-day gate behaviour is deterministic;
- longest streak uses the canonical badge engine;
- lifetime universal improvement remains null;
- no migration/backfill is introduced.

Stage 5 can now build the visible Performance Autobiography inside Progress from one tested foundation instead of duplicating historical logic in React components.
