# Verification Integrations — Stage 6 Plan / Consistency Verification

## Purpose

Stage 6 allows genuinely verified cardio evidence to satisfy a compatible planned cardio block without creating another Workout Tracker workout. It extends the canonical Consistency scorer with an optional evidence input while preserving manual logging as the primary training record.

## Authority contract

- Manual completion is evaluated first and always wins.
- Verified activity is evidence only and grants `0` bonus XP.
- One canonical verified activity may satisfy at most one planned block.
- A verified activity already linked to a completed manual block is consumed and cannot complete another block.
- A provider link to the same incomplete planned block may verify that block without writing to `logs`.
- Same-day evidence is required.
- Provider provenance plus objective distance or duration evidence is required.
- No Stage 6 code writes or backfills historical workout logs.

## Strict compatibility

Automatic plan satisfaction is deliberately narrow because historical Consistency schedule snapshots retain block ID and type, not the original semantic label.

- `run` evidence -> `run` or explicit `cardio`
- `cycle` evidence -> `cycle`, `bike` or explicit `cardio`
- `swim` evidence -> `swim` or explicit `cardio`
- `walk` evidence -> `walk` or explicit `cardio`
- `row` evidence -> `row` or explicit `cardio`
- `team_sport` / `other_cardio` -> explicit `cardio` only

`strength`, `hiit`, `box`, `session`, `recovery` and generic `duration` are not automatically satisfied by provider cardio evidence. Generic Duration is intentionally excluded because an old snapshot cannot tell whether it meant football, mobility, stretching or another timed activity.

## Consistency behaviour

`scoreConsistencyWindow` now accepts optional `verifiedCardioEvidence`. When omitted, existing scoring behaviour remains unchanged. With evidence supplied, each planned day reports manual and verified completion counts plus completion provenance (`manual`, `verified`, `mixed`, or `none`).

The Progress UI derives a private Plan Verification panel from the same verified activity payload already loaded by Connected Sources and the athlete's effective-dated Consistency schedule snapshots.

## Group privacy boundary

Stage 6 does not pass provider evidence into Group leaderboard, season-award or challenge scorers. Those server functions remain manual-only until a dedicated server-side adapter can derive only the necessary completion fact without exposing provider account IDs, activities, tokens or private health/activity detail to Groups.

## PB / improvement / rewards boundary

Stage 6 does not import verification evidence into:

- `xpEngine`
- badge award authority
- `groupImprovementEngine`
- manual PB/improvement history
- Strength performance authority

Verified plan completion can change a Consistency result only when a strict planned cardio block is genuinely satisfied. It cannot create a PB, rewrite a result, or add reward XP.

## Credentials

No live provider credentials are required for Stage 6. The provider-neutral canonical activity/evidence layer is sufficient to prove and gate the plan-completion policy.

The correct point to configure live Strava OAuth/webhook credentials is after this Stage 6 gate, when the next task is end-to-end live sync validation: authorize a real account, receive/import a real activity, reconcile it, match/dedupe it, and confirm the Stage 4–6 UI/Consistency behaviour against production-like source truth.
