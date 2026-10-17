# Chunk 02 — isolated database and versioned day saves

17 October 2026. Continues draft PR #144. Production has not been migrated, merged or deployed by this chunk. Current features remain free; no billing or subscription gates were added.

## Implemented

- Additive `20261017143531_versioned_log_saves.sql` adds a server row version and operation ID. The invoker-rights RPC checks ownership, applies existing RLS, locks a day row, rejects stale versions and safely acknowledges an exact repeated operation. Legacy writes also advance the version through a trigger.
- Opt in with `VITE_LOG_SYNC_MODE=versioned` only after applying the migration to the target backend. Missing/error responses retain the pending draft; the client never falls back to an unchecked UPSERT in this mode. The default remains legacy for rollout compatibility.
- The client retains its original base version across interruptions. Successful writes advance the base of causally newer edits from the same tab. A stale write pauses automatic retry and offers a comparison of device/account entries, with an explicit choice. A second concurrent update produces another conflict rather than silently replacing it.
- Selecting the account version discards only the matching local draft and updates the day/history immediately. Selecting the device version submits a new operation against the version reviewed. Whole-day choice is intentional; field merging is not implemented.
- Confirmed account deletion purges this account's pending journal on this device. Other accounts are retained. The storage notice explains draft retention and clearing app data.
- Android CI compiles the unconfigured debug shell with Java 21 and uploads `Workout-Tracker-shell-debug`. This artifact tests installation/packaging, not login or a functional beta. Android cloud backup is disabled for the app; account data remains in Supabase.

## Isolated backend

Development branch `native-app-foundation`, branch ID `d1d145ff-05c7-4f7a-9863-c310109ca69b`, project `relsoshjvfcjcwhzofjs`, region eu-west-1. API: https://relsoshjvfcjcwhzofjs.supabase.co. Created without data. Metadata checks after setup found 57 public tables, zero families, zero logs and zero auth users. No production records were copied.

Automatic migration provisioning initially failed because the old repository history depends on manually created legacy tables. `supabase/bootstrap/legacy-foundation.sql` reconstructs those prerequisites and fails closed on an existing `public.families` table. It is for a fresh isolated database only, never production. Existing repository migrations through `20261015220147_private_admin_usage.sql` were then applied in ordered batches, plus the new versioned-save migration. A large batch initially hit expired request-state errors; separating the coaching migration from its remainder succeeded.

The branch's migration ledger records these bootstrap/batch names rather than each original filename. Do not merge/rebase this branch into production or run an automatic migration-history repair. Production rollout should apply only the reviewed additive migration through the normal release process. The provider may continue to display the original provisioning failure even though schema recovery succeeded.

The native local environment has been configured against this staging URL with a public key and versioned mode; `.env.native.local` is ignored by git. No server secrets are bundled. CI shell mode strips backend configuration.

The Supabase function inventory lists 16 active functions. Their staging secrets, provider callbacks, email delivery and runtime behavior have not been verified. Auth redirect settings are not exposed by the currently connected management tools. Do not treat the schema and bundle checks as a completed authentication/provider test.

## Verification

`supabase/tests/versioned_log_saves.sql` passed against the staging Postgres database after all schema batches. It exercises create, exact replay, versioned update, stale conflict, unknown-base conflict, legacy version advancement, family/profile mismatch and cross-account RLS. Synthetic fixtures are rolled back.

App tests cover conflict review, choosing either version, reconnect behavior, sequential local edits, outbox replay identity and causal version advancement. RPC wrapper tests assert no fallback on missing functions and no confirmation of malformed responses. The full suite, web build, staging native sync and dependency audit were run; see PR validation for final results and the Android CI result.

Security advisors reported 19 informational RLS-enabled/no-policy findings and 81 warnings for authenticated execution of existing SECURITY DEFINER functions. These need function-by-function review before broad beta; the new log RPC uses SECURITY INVOKER and ownership/RLS tests passed. Do not blanket-revoke existing application RPCs.

- RLS reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Function privilege reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Next release gates

1. Configure staging auth site URL, native callback allowlist (`io.workouttrackerapp.app://auth/callback`) and test email delivery. Verify signup, confirmation, reset and cold/warm app callbacks on real devices.
2. Verify all 16 staging Edge Functions and required secrets with isolated provider configuration. Keep provider webhooks separate from production.
3. Produce a configured Android beta and an iOS build on macOS/Xcode. Publisher accounts, final app identifier, signing, Apple Team ID and Android certificate fingerprints remain release inputs.
4. Test two devices editing the same day, force-close before/after acknowledgements, offline replay, account switching/deletion and storage failure. Automated stale-version tests are not a physical multi-device test.
5. Replace default icons/splash, optimize the approximately 447 MB public asset tree, review default permissions and complete accessibility/device QA before broad distribution.
6. Review existing privileged RPCs, production migration rollout and rollback, then complete the feature regression matrix in the source plan. Plans/programmes/assessments and provider actions are not made offline by the day-log journal.
