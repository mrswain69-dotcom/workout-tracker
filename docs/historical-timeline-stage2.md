# Historical Timeline / Performance Autobiography — Stage 2: Historical Event Engine

## Purpose

Stage 2 introduces the deterministic event-extraction layer that turns existing authoritative history into typed autobiography evidence without creating a second history database.

The engine is pure application logic. It does not mutate logs, Assessments, Groups, XP, badges, plans or profile data.

## Canonical engine

`src/engine/historicalTimelineEventEngine.js`

The engine can compose three source families today:

1. workout / recovery logs;
2. completed Assessment runs;
3. frozen Group Progress Awards.

Knowledge and long-range Consistency milestones remain future adapters because Stage 0 explicitly requires genuine source authority before those event types can exist.

## Workout event rules

A stored log row is not automatically a historical performance event.

Stage 2 requires actual recorded performance/recovery evidence:

- strength/HIIT/box sets containing a recorded repetition, load or time;
- cardio with recorded distance, duration or speed;
- duration activity with recorded minutes;
- a recovery block explicitly completed;
- a structured Session with genuine activity according to the existing Session Engine.

Empty plan snapshots, untouched planned blocks and cancelled blocks do not become autobiography history.

### Legacy coexistence

Legacy `entries` remain genuine historical evidence, but their movement identity is limited to the stable movement key stored in the old log.

Stage 2 deliberately leaves the legacy movement `name` blank rather than looking at today's Plan and pretending that a current label was historically frozen.

Modern block logs may use their frozen movement labels from the historical block snapshot.

### Cardio mirror protection

Older/current logs can contain the same cardio values both in the top-level legacy mirror and in the block record. Stage 2 detects an equivalent mirror and retains one cardio evidence row rather than double-counting the activity.

### Structured Sessions

Structured Session events reuse the existing Session Engine for:

- activity detection;
- completion state;
- actual training minutes;
- training-load calculation.

A Session event uses its frozen historical template ID/code/name/version. Current Session Library edits are never projected backwards.

A log containing a Session produces:

- a private `training_day` evidence event; and
- a typed `session_completed` or `session_partial` event.

The later autobiography view may choose its presentation density without changing source truth.

## Assessment event rules

Only `assessment_runs.status = completed` may produce an `assessment_completed` event.

The event retains:

- frozen template ID/version/name evidence;
- total persisted Test result count;
- valid-result count;
- stable IDs of valid results.

Stage 2 does **not** independently decide PBs or improvement percentages. Stage 3 must reuse the existing Assessment comparison/history engines for those claims.

Production still contains zero completed Assessment runs, so this adapter correctly returns no production Assessment events today.

## Group award event rules

Only persisted frozen `group_progress_awards` supplied for the athlete's own membership IDs may become award events.

The milestone date is the frozen period end, not the current date and not a live leaderboard state.

The event preserves the recorded award type, rank, score value/unit and period identity. It does not invent a combined MVP score.

Production still contains zero frozen Group Progress Awards, so this adapter correctly returns no production award events today.

## Event identity and ordering

Every event has:

- deterministic `id`;
- athlete `profileId`;
- source date;
- derived attained `age` or `null` when birth date is unavailable;
- controlled `sourceType`;
- stable `sourceId`;
- controlled `eventType`;
- concise title;
- typed `evidence`;
- `evidenceState: recorded`.

Canonical sort order is chronological, then deterministic source priority and stable event ID. Same-day ordering therefore does not depend on database return order.

## Privacy

The engine operates on own-family/private source data and returns private autobiography evidence.

Group Awards are filtered by the caller-supplied own membership IDs. No other athlete's workout, Assessment or profile record is needed to compose the private timeline.

`birth_date` remains absent from all Group UI and Group Edge Functions under the permanent Stage 1 guard.

## Stage 2 acceptance examples

Permanent tests prove that:

- empty/cancelled planned blocks create no event;
- legacy strength evidence is retained without a fabricated historical name;
- frozen Session identity is used;
- duplicate cardio mirrors are not double-counted;
- in-progress Assessments create no event;
- invalid Assessment result rows are not counted as valid evidence;
- only supplied own-membership awards are accepted;
- frozen period end becomes the award milestone date;
- mixed source families sort deterministically.

## Next stage

Stage 3 will consume these typed events plus the existing comparison engines to build **Age Chapters**, metric-specific strength/cardio summaries and truthful improvement highlights.
