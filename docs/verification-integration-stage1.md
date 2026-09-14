# Verification Integrations — Stage 1 External Activity Foundation

Status: Stage 1 implementation candidate on `feature/verified-activity-layer`.

## Objective

Stage 1 creates the private provider-neutral persistence layer beneath the Stage 0 authority contract.

It does not connect to Strava, Garmin, Apple Health or Health Connect yet. It creates the stable internal structures those providers will populate later.

No existing Workout Tracker history is converted, copied or rewritten.

## Production migration

Applied migration:

`20260912223027_verification_stage1_external_activity_foundation`

The migration is additive only.

Immediately after deployment:

- external connections: 0
- external activity observations: 0
- verified activities: 0
- verified activity/observation links: 0
- external/manual verification links: 0
- existing workout logs: 499

No historical workout row changed.

## Data model

### `external_connections`

Stores non-secret connection metadata for one athlete/provider relationship:

- family/profile ownership;
- provider identity;
- provider account ID when known;
- connection state;
- automatic-sync preference;
- granted scope names;
- last successful sync time;
- non-secret error code metadata.

One athlete has at most one row per provider.

Provider access tokens, refresh tokens, OAuth authorization codes and client secrets are deliberately absent.

### `external_activity_observations`

Stores one provider's normalized observation of one activity.

It retains:

- connection/provider provenance;
- provider activity ID;
- athlete ownership;
- activity start time/type/name;
- only metrics actually supplied by the provider;
- provider created/updated/deleted timestamps where available.

The unique `(connection_id, provider_activity_id)` boundary makes provider ingestion idempotent.

### `verified_activities`

Represents one physical activity identity inside Workout Tracker's verification layer.

It deliberately does not contain XP or a replacement manual workout payload.

Stage 3 will decide how observations are matched into these identities. Stage 1 only provides the safe persistence target.

### `verified_activity_observations`

Many provider observations may describe one physical verified activity.

Each external observation may belong to only one verified activity identity, which prevents a single source activity from being duplicated across multiple physical identities.

### `external_activity_links`

Links one verified physical activity to an existing Workout Tracker manual log, with optional block ID and match metadata.

It is a relationship only. It does not mutate `logs.log_json`.

The integrity trigger requires the verified activity and manual log to belong to the same family and athlete.

## Integrity boundaries

Private trigger functions enforce:

- a connection's profile belongs to its supplied family and is not archived;
- connection family/profile/provider identity cannot be reassigned;
- an observation's family/profile/provider exactly matches its connection;
- provider observation identity cannot be reassigned after creation;
- verified activity family/profile identity cannot be reassigned;
- observation-to-verified-activity links stay within one athlete;
- verified-to-manual links stay within one athlete.

These are database-level guarantees rather than UI assumptions.

## Browser / RLS model

All five Stage 1 tables have RLS enabled.

For `anon` and `authenticated`, all default privileges are revoked first. The browser then receives only `SELECT` on the five tables.

Each table has an own-family `SELECT` policy resolving ownership through `families.owner_user_id = auth.uid()`.

Therefore a signed-in family can inspect its own verification data, but the browser cannot insert, update, delete or forge verified provider evidence.

Provider ingestion and matching will be server-side in later stages.

## Credential boundary

Stage 1 intentionally does not solve OAuth credential storage prematurely.

Provider credentials are not stored in:

- `profiles`;
- `logs`;
- connection metadata exposed to the browser;
- activity observations;
- verified activity identities;
- Groups.

Stage 2 will add the Strava OAuth/token lifecycle behind a server-only boundary after reviewing the current provider requirements and token-refresh model.

## Client adapter

`src/verifiedActivityDb.js` adds one read-only loader for the selected athlete.

It reads:

- connections;
- observations;
- verified activities;
- observation membership links;
- manual verification links.

It performs no mutation calls.

## Security verification

After the migration:

- all new tables have own-family RLS policies;
- the authenticated role has `SELECT` only;
- no new Supabase security-advisor warning was introduced by the verification tables or private integrity triggers;
- the advisor output still contains only the already-known Group/server-only-table and Auth configuration notices that pre-date this stage.

## Stage 1 acceptance gate

Stage 1 is complete only when:

- the production migration exists with the same version as the repository file;
- all five tables exist with RLS enabled;
- authenticated browser access is read-only;
- provider secrets are absent from the client-visible schema and adapter;
- family/profile/provider integrity is enforced in the database;
- all new tables begin empty;
- the existing 499 workout logs remain unchanged;
- permanent tests lock the additive/read-only/credential-isolation rules;
- the full test suite, production build, security audit and exact-head Vercel preview pass.

Stage 2 can then implement the first real provider connection — Strava — without changing the authority model or database meaning established here.
