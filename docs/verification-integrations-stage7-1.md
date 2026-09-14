# Verification Integrations — Stage 7.1 Connection Management Architecture

Stage 7.1 separates provider administration from evidence consumption before Verification Integrations is merged to production `main`.

## Product boundary

- **Manage → Connections** owns athlete/provider assignment, connect/disconnect, provider identity and data-stream preferences.
- **Progress** is a read-only consumer of verified activity evidence.
- **Assessment Analysis** no longer owns provider connection controls.
- **Groups** continue to receive no raw provider credentials or observations; any future group use must consume provider-neutral derived verification only.

## Athlete identity

Every provider connection belongs to exactly one Workout Tracker `profile_id`. Connection UI requires the parent to explicitly choose the athlete and confirms the assignment before OAuth starts. The one-time OAuth state carries that profile ID through the provider redirect, so a Strava account authorised for Paul cannot silently attach itself to Wilf or Xander.

`external_connections.provider_account_label` stores a safe display label returned by the provider so Settings can show a human-readable sanity check without exposing tokens.

## Stream preferences

`external_connection_preferences` is provider-neutral and profile-scoped. Initial fields are:

- `activity_data_enabled` — core activity evidence; currently required while an activity connector is in use.
- `performance_metrics_enabled` — optional activity detail such as elevation/calories.
- `heart_rate_enabled` — average/max HR; **off by default**.
- `route_location_enabled` — reserved for future explicit route/location ingestion; off by default.
- `health_recovery_enabled` — reserved for future health/recovery APIs; off by default.
- `include_private_activities` — provider OAuth preference for private activity access; off by default.

Authenticated browser clients may read preferences but may not mutate them directly. Changes go through the JWT-protected `external-connection-preferences` Edge Function. Disabling HR or performance detail scrubs already-retained optional fields for that profile/provider. Enabling a stream applies to newly synced activity; historical backfill can be added as an explicit later action.

## Strava enforcement

The shared Strava normalizer loads the profile/provider preferences before observations are persisted. Core verification fields (activity type, date/time, distance, duration and provenance) remain available while optional HR and performance fields obey the preference flags. `include_private_activities` determines the OAuth scope requested on the next connection/reconnection.

## Authority remains unchanged

- Provider data never creates Workout Tracker `logs`.
- Manual history remains canonical.
- Verification remains reward-neutral (`0` bonus XP).
- Provider-manual Strava entries remain ineligible for strong verification.
- PB/improvement authority is unchanged.
- Existing 499 historical logs are not rewritten or backfilled.
