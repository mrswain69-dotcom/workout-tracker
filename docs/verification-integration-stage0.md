# Verification Integrations — Stage 0 Truth & Authority Contract

Status: Stage 0 implementation candidate on `feature/verified-activity-layer`.

## Objective

Stage 0 defines the authority boundary for wearable/platform verification before any provider OAuth, webhook, background sync or UI is introduced.

The roadmap's Verification Integration phase is an integrity-layer expansion. It explicitly names Garmin, Strava, Apple Health and Google Fit and says manual logging remains valid, verification enhances trust, and verification must never break XP caps, enable farming or override improvement logic.

This stage turns those principles into a provider-neutral contract that later integrations must obey.

## Core model

Workout Tracker keeps two distinct kinds of evidence:

1. **Workout Tracker records** — plans, days, blocks, entries, Sessions, Assessments, XP and user-entered performance history.
2. **External activity observations** — facts reported by connected providers such as Garmin or Strava.

An external observation is evidence about activity. It is not automatically a Workout Tracker workout and it is not allowed to rewrite an existing Workout Tracker log.

The system may later create a **verification link** between a Workout Tracker record and one or more external observations. That link adds provenance and trust without duplicating the underlying physical activity.

## Provider-neutral first

Provider-specific APIs plug into one internal representation.

The initial provider identifiers are:

- `garmin`
- `strava`
- `apple_health`
- `health_connect`
- `google_fit_legacy`

`google_fit_legacy` exists only so historical/provider-origin records can retain accurate provenance. New Android work should use the current Health Connect path rather than creating a new dependency on the retiring Google Fit API surface.

No provider is allowed to introduce its own XP, PB, Consistency or leaderboard rules.

## Authority rules

### Manual history

External evidence must never:

- update `logs.log_json`;
- manufacture Workout Tracker blocks or sets;
- delete a manual Workout Tracker record when a provider activity disappears;
- replace a user's manually recorded weights/reps/results;
- silently convert a manual record into a provider record.

Manual logging remains fully valid whether or not a provider is connected.

### XP

Stage 0 deliberately activates **no verification XP bonus**.

Every external observation and verification link therefore has:

- `xpDelta = 0`;
- `multiplier = 1`;
- `policy = verification_bonus_not_activated`.

The roadmap/system specification allows a future controlled Verified Activity multiplier. That future policy is not deleted from the product vision, but it must be introduced separately through the canonical XP engine, remain subject to all caps and anti-farming rules, and must never cause one physical activity to earn XP twice simply because two providers observed it.

### Improvement / PB logic

External data may later contribute objective, compatible evidence such as:

- distance;
- elapsed/moving duration;
- pace/speed;
- heart rate;
- elevation;
- provider-recorded activity type.

However provider evidence cannot create a Strength PB merely because a provider labels an activity `strength`.

Any external measurement that enters Progress or the Performance Autobiography must pass the same metric-compatibility rules as native history. Verification does not override the improvement engine.

### Consistency / plan completion

A future matching stage may allow an external activity to verify that a planned activity happened.

That must remain a relationship, not a rewritten plan/log. One physical activity may satisfy at most the appropriate planned requirement once. Provider duplication must not create extra completed days.

### Deletion and correction semantics

Provider records are treated as present-source evidence:

- provider correction -> external observation updates;
- provider deletion -> evidence becomes deleted/unavailable according to provider semantics;
- linked manual Workout Tracker history remains untouched;
- derived verification state may change when the source changes.

This mirrors the Performance Autobiography rule that derived history follows current source truth while authoritative source records retain their own provenance.

## One activity, many observations

Garmin -> Strava is a normal real-world path. If both accounts are connected, Workout Tracker must not produce two workouts.

The architecture therefore distinguishes:

- **external observation** — one provider's representation of an activity;
- **verified activity identity** — one physical activity that can contain one or more observations;
- **verification link** — optional relationship from that physical activity/evidence to a Workout Tracker record.

Stage 0 does not yet decide the matching algorithm. It only locks the data model so Stage 3 can implement deterministic deduplication safely.

## Provenance

Every external observation must retain at minimum:

- provider;
- provider activity ID;
- athlete/profile ID;
- source timestamp;
- activity type;
- verification state;
- provider-origin metrics that were actually supplied;
- created/updated source timestamps where available.

The normalized record must never pretend a missing metric was measured.

## Privacy / credentials

Provider credentials and refresh tokens are private integration secrets.

They must never be:

- stored in workout JSON;
- returned through Group payloads;
- exposed in client-visible profile data;
- used as authorization proof for another athlete.

Future provider callbacks must resolve a connection to the exact owned athlete/family before importing activity evidence.

External activity rows are private own-family performance data.

## Product/UI contract

Verification is a confidence signal, not a social status system.

Future UI may show restrained states such as:

- `Verified by Garmin`
- `Verified by Strava`
- `Garmin + Strava`
- `Imported activity`
- `Matched to today's Cardio session`

Verification must not create follower, feed or vanity mechanics.

## Phase roadmap

The build order is locked as:

### Stage 0 — Truth & authority contract

Provider-neutral evidence rules, reward isolation and permanent regression tests.

### Stage 1 — External activity foundation

Private connection/activity/link tables plus a provider-neutral persistence adapter. No provider OAuth yet.

### Stage 2 — Strava connection

OAuth/token lifecycle, historical import and automatic webhook ingestion.

### Stage 3 — Matching & deduplication

One physical activity across Garmin/Strava/manual evidence, deterministic matching and conflict handling.

### Stage 4 — Verified Activity UI

Connected Sources settings, verification marks, source evidence and activity detail.

### Stage 5 — Progress / Performance Autobiography

Compatible verified cardio evidence and historical milestones without synthetic performance claims.

### Stage 6 — Plan / Consistency verification

Safely use verified external evidence to satisfy planned activity requirements once.

### Stage 7 — Garmin Connect

Connect Garmin through the already-proven provider-neutral architecture once developer access is available.

### Stage 8 — Native health bridges

Apple HealthKit and Android Health Connect through native mobile shells/bridges when Workout Tracker is packaged as native apps.

## Stage 0 acceptance gate

Stage 0 is complete only when permanent tests prove:

- supported provider identities are normalized through one engine;
- external evidence is explicitly marked separate from Workout Tracker manual authority;
- verification is reward-neutral by default;
- external normalization never produces a manual `log_json`, blocks or entries payload;
- verification links do not mutate either source object;
- multiple provider observations can belong to one physical verified activity identity without becoming extra Workout Tracker workouts;
- missing provider metrics remain missing rather than fabricated;
- future verification bonus language remains isolated from the active XP policy;
- full test suite, production build and security audit stay green.

Stage 1 may then create the private persistence layer under this contract.
