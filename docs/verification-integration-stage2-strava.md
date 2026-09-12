# Verification Integrations — Stage 2 Strava Connection

Status: connector infrastructure implemented and deployed; live athlete authorization remains pending Strava developer-application credentials/secrets.

## Objective

Stage 2 proves the first real provider against the provider-neutral Stage 0/1 authority model.

Strava is used first because its OAuth + webhook model lets Workout Tracker prove automatic external evidence ingestion without changing manual workout, XP or improvement authority.

## Current Strava contract

The implementation follows the current Strava API requirements verified during Stage 2:

- web OAuth uses `https://www.strava.com/oauth/authorize`;
- authorization codes are exchanged for short-lived access tokens plus refresh tokens;
- access tokens expire after roughly six hours and are refreshed server-side;
- a successful refresh may return a new refresh token, so Workout Tracker always persists the newest refresh-token response;
- `activity:read` is the default requested scope;
- `activity:read_all` is requested only when the user explicitly opts to include Only You/private activities;
- `activity:write` is never requested;
- webhooks are used for automatic create/update/delete/deauthorization events instead of polling;
- webhook POSTs must be acknowledged quickly, so durable receipt happens first and deeper processing runs with `EdgeRuntime.waitUntil()`;
- the current Strava webhook example signs POST bodies with `X-Strava-Signature`, which Workout Tracker verifies before accepting an event;
- current Strava deauthorization uses the 2026 `POST /oauth/revoke` flow.

`STRAVA_API_BASE_URL` is configurable because Strava has announced an API-base transition beyond the current production base. Provider URLs therefore do not need to be rewritten through the rest of Workout Tracker when that transition occurs.

## Server-only authority

Production migration:

`20260912223527_verification_stage2_strava_server_authority`

creates four server-authority tables:

### `external_connection_access_tokens`

Stores only the current short-lived access token and expiry for a connection.

### `external_connection_refresh_tokens`

Stores the current refresh token separately from the access token.

The two-token split follows the provider lifecycle and keeps refresh-token rotation explicit.

### `strava_oauth_states`

Stores only a SHA-256 hash of a one-time OAuth state plus the exact family/profile target, requested scopes and expiry.

Plain OAuth state is never stored.

The callback atomically consumes an unconsumed, unexpired state before token exchange, so replayed callbacks cannot reuse it.

### `strava_webhook_events`

Durably records accepted webhook events before asynchronous processing.

A SHA-256 event key makes identical Strava retries idempotent.

## Browser isolation

All four Stage 2 authority tables:

- have RLS enabled;
- revoke all access from `public`, `anon` and `authenticated`;
- grant server authority to `service_role` only;
- carry explicit deny policies for authenticated clients.

The browser never selects or receives:

- access tokens;
- refresh tokens;
- OAuth authorization codes;
- Strava client secret;
- webhook signing secret.

`src/stravaConnectionDb.js` exposes only calls to the authenticated start/disconnect functions.

## OAuth start

`strava-oauth-start` is deployed with JWT verification enabled.

It:

1. validates the signed-in user;
2. reads the exact requested profile through ordinary profile RLS;
3. only after ownership proof generates a random one-time state;
4. stores only its SHA-256 hash through server authority;
5. requests read-only activity scope;
6. returns the Strava authorization URL to the browser.

It never returns a provider credential.

## OAuth callback

`strava-oauth-callback` is public at the gateway because Strava's browser redirect must reach it without a Supabase user JWT.

It is not authorization-free. It requires the one-time state created by the authenticated start function.

The callback:

1. hashes the returned state;
2. consumes exactly one matching unexpired state;
3. exchanges the authorization code server-side;
4. validates the scopes the athlete actually granted;
5. upserts one Strava connection for the target Workout Tracker athlete;
6. stores access and refresh tokens only in server-authority tables;
7. starts a bounded recent-history import in the background;
8. redirects only to the fixed configured Workout Tracker URL.

There is no caller-controlled return URL/open-redirect path.

## Initial history import

The default first import covers the most recent 90 days.

`STRAVA_INITIAL_IMPORT_DAYS` may configure this from 1 to 365 days. The import is bounded to ten 100-activity pages.

Every activity is upserted by the Stage 1 unique provider identity `(connection_id, provider_activity_id)`, making re-imports idempotent.

Initial import creates external observations only. It never creates or rewrites a Workout Tracker log.

## Automatic webhooks

`strava-webhook` is public at the gateway and verifies Strava itself.

Validation includes:

- GET subscription verify-token challenge;
- `X-Strava-Signature` HMAC-SHA256 verification on POST;
- five-minute signature timestamp tolerance;
- valid object/aspect/event fields;
- optional exact subscription-ID check once the production subscription exists.

Accepted events are written to `strava_webhook_events` before `EdgeRuntime.waitUntil()` starts processing.

Processing semantics:

- activity create/update -> refresh token if required, fetch latest activity, upsert external observation;
- activity delete/privacy-unavailable -> tombstone external observation with `source_deleted_at`;
- athlete deauthorization -> mark connection disconnected and destroy stored provider tokens;
- duplicate webhook retry -> acknowledge existing durable event without processing twice.

No webhook path writes `logs.log_json`.

## Disconnect

`strava-disconnect` is JWT-protected and resolves the target connection through the signed-in family's RLS view before accessing server token authority.

It uses Strava's current revoke endpoint, marks only the provider connection disconnected and removes provider tokens.

External observation history remains as historical provenance; manual Workout Tracker history is untouched.

## Deployed functions

Production Supabase currently has these ACTIVE functions:

- `strava-oauth-start` — `verify_jwt=true`;
- `strava-oauth-callback` — `verify_jwt=false`, one-time-state protected;
- `strava-webhook` — `verify_jwt=false`, verify-token/HMAC protected;
- `strava-disconnect` — `verify_jwt=true`.

## Activation dependency

The code is deployed but cannot authorize a real athlete until a Strava developer application is created and production secrets are provisioned.

Required secrets/configuration are:

- `STRAVA_CLIENT_ID`;
- `STRAVA_CLIENT_SECRET`;
- `STRAVA_WEBHOOK_VERIFY_TOKEN`;
- `STRAVA_WEBHOOK_SIGNING_SECRET`;
- `WORKOUT_TRACKER_APP_URL`;
- `STRAVA_WEBHOOK_SUBSCRIPTION_ID` after the one application-level subscription is created.

Optional overrides:

- `STRAVA_OAUTH_CALLBACK_URL`;
- `STRAVA_INITIAL_IMPORT_DAYS` (default 90, max 365);
- `STRAVA_API_BASE_URL` for provider base-URL transition.

Secrets must be set in Supabase project secrets, never committed to GitHub.

## Production impact

Immediately after the Stage 2 migration/function deployment:

- stored access tokens: 0;
- stored refresh tokens: 0;
- OAuth state rows: 0;
- webhook events: 0;
- external connections: 0;
- external observations: 0;
- existing Workout Tracker logs: 499.

The Supabase security advisor reports no new Verification Integration warning.

## Stage 2 release state

The implementation portion is complete and CI/Vercel green. Live Strava activation is deliberately not called complete until the developer app/secrets and application-level webhook subscription are configured and one real end-to-end authorization/sync has been verified.

Stage 3 can proceed independently because matching/deduplication consumes provider-neutral Stage 1 observations rather than provider credentials.
