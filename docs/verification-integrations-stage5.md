# Verification Integrations — Stage 5

## Verified cardio evidence in Progress and the Performance Autobiography

Stage 5 makes genuinely synced cardio evidence useful inside Workout Tracker without changing the authority of the existing workout, PB, improvement, reward or Group systems.

## Scope

Stage 5 is a read-side integration only. It introduces no new database migration and no new provider write authority.

Verified activity data continues to live in the provider-neutral verification layer introduced in earlier stages. The browser reads current source truth and derives a display model for Progress and the Performance Autobiography.

## Canonical activity rule

One physical activity is one verified activity.

Multiple provider observations may support the same canonical `verified_activity`. For example, a Garmin-origin run that is also present in Strava remains one verified activity with two evidence sources. Stage 5 therefore derives cardio evidence from `verified_activities` plus their current non-deleted observations rather than counting provider rows independently.

Provider observations with `source_deleted_at` are excluded from current evidence. If no live observation remains, the activity is not presented as current verified cardio evidence.

## Cardio evidence

Compatible provider observations may contribute display-only evidence such as:

- activity type;
- local activity date;
- distance;
- moving or elapsed duration;
- derived average speed;
- derived run/walk pace;
- average and maximum heart rate;
- elevation gain;
- calories where supplied by the provider;
- provider provenance;
- whether the verified identity is matched to an existing manual Workout Tracker log.

Derived speed and pace are transformations of source distance and duration. They are not new performance authority.

## Progress

The Connected Sources section includes a Verified Cardio summary showing canonical activity count, verified distance, verified time and heart-rate evidence coverage.

This summary is evidence only. It does not add a Workout Tracker workout, complete a plan, change Consistency, grant XP or award a badge.

## Performance Autobiography

The same verification payload used by Connected Sources is passed to the Performance Autobiography. It is not fetched independently, so both views describe the same canonical source truth.

When an Age chapter is available, verified cardio evidence is scoped to that chapter's birthday-to-birthday date range. Without an Age chapter, the evidence remains available as date-based history.

Verified cardio appears in its own evidence panel before the existing milestone feed. It is deliberately not converted into a milestone or PB event.

## PB and improvement authority remains unchanged

Stage 5 does not pass verification data into `buildHistoricalTimelineEvents`, `buildHistoricalAutobiographyFoundation`, `buildHistoricalAgeChapters` or `buildImprovementObservations`.

The existing PB / improvement machinery therefore remains based on its existing Workout Tracker workout and Assessment authorities. Provider evidence cannot:

- create a manual cardio PB;
- replace a manual PB;
- increase the Performance Autobiography PB / improvement count;
- alter the Career Summary improvement year;
- enter Group improvement calculations.

This separation is protected by Stage 5 regression tests.

## Reward authority remains unchanged

Verified cardio has explicit `authority: "verified_evidence_only"` and `rewardXp: 0` semantics.

The verified cardio engine is not imported by the XP engine or badge statistics engine. Merely connecting a provider or syncing an activity grants no reward advantage.

## Corrections and deletions

The evidence view is derived from current verification source truth. Provider corrections can update the visible evidence. Provider deletions remove that provider observation from current evidence.

Neither operation rewrites or deletes the user's manual Workout Tracker log.

## No historical backfill

Stage 5 performs no migration, mutation or backfill of historical Workout Tracker logs. The existing 499 production log rows remain outside the verification schema and keep their original authority.

## Next stage

Stage 6 can consider Plan / Consistency verification: allowing a sufficiently matched verified activity to satisfy an appropriate planned activity without creating a duplicate manual workout or duplicate XP event.

That future step requires its own explicit authority and matching contract before it is enabled.
