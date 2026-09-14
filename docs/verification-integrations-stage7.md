# Verification Integrations — Stage 7

## Purpose

Stage 7 hardens live-provider provenance before the first real Strava account is imported into Workout Tracker.

The core rule is:

> Provider-connected does not automatically mean device-verified.

A provider may contain activities that were typed in manually. Those activities may remain visible as synced source history, but they must not become trusted verification evidence merely because they came through an OAuth connection.

## Provider-neutral provenance

`external_activity_observations` now stores:

- `source_manual_entry`
- `source_device_name`
- `source_external_id`
- `source_upload_id`

These fields are deliberately provider-neutral so Garmin, Apple HealthKit, Health Connect and future connectors can express equivalent provenance without creating provider-specific verification columns.

## Strava mapping

The Strava normalizer persists:

- Strava `manual` -> `source_manual_entry`
- Strava `device_name` -> `source_device_name`
- Strava `external_id` -> `source_external_id`
- Strava `upload_id` -> `source_upload_id`

OAuth tokens, refresh tokens and application secrets remain server-side only.

## Verification eligibility

A live provider observation is eligible for verified cardio evidence when it is not source-deleted and is not explicitly a provider-manual entry.

A canonical activity that contains only provider-manual observations does not produce verified cardio evidence and cannot satisfy a planned activity in Consistency.

If the same canonical physical activity contains a manual Strava observation plus a genuine eligible observation from another provider, the genuine observation may still establish verification. Metrics used by verified cardio evidence are taken only from eligible observations.

The current evidence labels are:

- `device_or_file` — an eligible observation contains device, external-file or upload provenance.
- `provider_recorded` — eligible provider evidence exists, but no stronger device/file identifier is available.
- provider-manual entries are not verification eligible.

These are evidence-quality labels, not reward tiers.

## User interface

Connected Sources distinguishes:

- **Synced activities** — all current canonical provider activity visible to the athlete.
- **Verified cardio** — the subset eligible to contribute verification evidence.

Recent activity is labelled as:

- `Device/file evidence`
- `Provider-recorded evidence`
- `Manual provider entry · not verification eligible`

Provider-manual entries remain visible for transparency but cannot verify Progress, a PB, a planned block or rewards.

## Authority boundaries

Stage 7 does not change the existing authority rules:

- manual Workout Tracker logs are not mutated or backfilled;
- provider evidence does not create Workout Tracker log rows;
- PB/improvement authority is unchanged;
- provider evidence remains reward-neutral with `0 bonus XP`;
- Group callers do not receive private provider observations or provenance;
- one physical activity is still deduplicated before verified evidence is counted.

## Live Strava activation sequence

1. Complete provenance hardening and exact-SHA CI/deployment gate.
2. Configure Strava application credentials as Supabase Edge Function secrets.
3. Connect one real athlete through Workout Tracker OAuth.
4. Verify token persistence, initial bounded import, provenance, reconciliation, Progress evidence and Consistency behaviour.
5. Verify disconnect/reconnect behaviour.
6. Register the Strava webhook only after the official production webhook-signing mechanism is resolved. The existing webhook endpoint intentionally requires signed events and will not be weakened to bypass that boundary.

## Garmin

Garmin Connect Developer Program Activity API access has been requested separately. Garmin, if approved, will use the same provider-neutral observation and verification architecture rather than a parallel Garmin-specific scoring path.
