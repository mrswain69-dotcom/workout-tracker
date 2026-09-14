# Verification Integration — Stage 3 Matching & Deduplication

## Status

Stage 3 establishes durable one-physical-activity identity and conservative links between external provider evidence and Workout Tracker manual history.

## Authority rules

- External provider observations remain separate from Workout Tracker `logs`.
- One real activity may have observations from multiple providers but only one `verified_activities` identity.
- Matching is reward-neutral. Verification does not change XP, multipliers, badges or workout completion authority.
- Provider corrections/deletions recompute derived verification state from current source truth; manual workout history is never rewritten or deleted.
- Ambiguous matches remain unlinked rather than being guessed.
- Same-provider observations are never automatically merged with each other.
- Provider-local date and timezone are retained so UTC date boundaries do not silently move an activity onto the wrong Workout Tracker day.

## Provider-to-provider deduplication

`src/engine/verificationMatchingEngine.js` and the server reconciler use conservative evidence:

- same athlete;
- different providers;
- compatible activity family;
- compatible provider-local date when present;
- close absolute start time when an exact time is available;
- compatible distance and/or duration.

Obscured/placeholder times do not create a time match. A provider pair must meet the configured confidence threshold before it can become one verified identity.

## Manual matching

Manual candidates are derived from existing cardio/duration evidence already present in Workout Tracker logs. The reconciler scores date, compatible activity family, distance and duration.

A manual link is created only when:

- the best candidate clears the minimum confidence threshold; and
- it beats the second-best candidate by the ambiguity margin.

One manual target can be claimed by at most one verified activity. Stage 3 hardening adds unique database indexes for exact manual blocks and legacy/log-level cardio, while the reconciler also removes an already-claimed candidate from later matching attempts in the same run.

## Derived-state recomputation

Verification links are derived state. For each verified identity the reconciler removes the previous derived manual link before inserting the current match. This allows corrected provider evidence to move from one manual candidate to another without mutating the manual log itself.

Provider observations that are deleted are excluded from active grouping. Verified identities that no longer have an active Stage 3 identity key are removed, with dependent verification links cascading away.

## Automatic reconciliation

Reconciliation is server-authoritative and can be invoked through the JWT-protected `verification-reconcile` Edge Function after exact profile ownership is proven through normal profile RLS.

Strava integration calls the same server reconciler automatically:

- after the initial recent-activity import following OAuth connection;
- after activity create/update webhook processing;
- after activity deletion/tombstoning.

This means an incoming provider activity can progress from provider evidence to deduplicated verified identity and a clear manual link without a user pressing an import/reconcile button.

## Persistence

Stage 3 adds:

- provider-local activity date/timezone metadata;
- versioned identity method/confidence metadata;
- stable `identity_key` values for idempotent reconciliation;
- uniqueness constraints preventing duplicate claims on one manual target.

All browser-visible verification tables remain read-only through the Data API. Writes are performed by server-authority code after ownership or provider-webhook authentication.

## Non-goals

Stage 3 does not:

- activate any verification XP bonus;
- make provider data authoritative for strength sets/reps/weight;
- auto-complete training plans or Consistency requirements;
- surface the Connected Sources/Verified Activity UI;
- activate a live Strava account without Strava developer credentials;
- add Garmin, HealthKit or Health Connect ingestion yet.

Those remain later stages.