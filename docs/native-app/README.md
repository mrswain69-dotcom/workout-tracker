# Workout Tracker native app implementation

This directory records implementation of the Native App Build Plan v1.0 (17 October 2026). Preserve current web features as free; no billing or paid access is enabled by this change.

## Build chunks

See [chunk-01.md](chunk-01.md) for the audited baseline and [chunk-02.md](chunk-02.md) for isolated staging and versioned saves. [chunk-03.md](chunk-03.md) records native resume refresh, lossless packaging and configured staging builds. This is a development foundation, not a store-ready release.

## Build and sync

Use Node 24 and `npm ci`. The web continues to build with `npm run build` into `dist/`. Native uses `npm run build:native` into `dist-native/` and `npm run native:sync` copies that bundle and plugin configuration into both platform projects.

1. Use the isolated Supabase test backend documented in chunk 02. Do not copy production data.
2. The standard staging command uses public configuration pinned to the isolated project. For a custom local test setup, copy `.env.native.example` to `.env.native.local` and set the **test** URL/public key. Keep `.local` files out of git. Never put service-role or secret keys in VITE variables.
3. Add `io.workouttrackerapp.app.staging://auth/callback` to the **test** project's auth redirect allowlist. Configure the test site URL and email separately from production. The release scheme `io.workouttrackerapp.app://auth/callback` is for a later reviewed release build.
4. For the isolated debug build run `npm run native:sync:staging`. Its callback is `io.workouttrackerapp.app.staging://auth/callback`; configure the test Auth allowlist first. Use `npm run native:sync` only for a deliberately configured release-ID bundle.
5. Android debug builds use the separate `.staging` application ID. Open Android Studio using `npm run native:android`, or Xcode on macOS using `npm run native:ios`.
6. Use test accounts to verify signup, confirmation, password reset, logging, app interruption and reconnection before configuring production.

The provisional application ID is `io.workouttrackerapp.app`. Confirm it before registering store records. Both platforms register the custom auth callback. HTTPS universal/app links are not yet configured: they require the verified Apple Team ID and Android signing certificate fingerprint. Group and provider links still require native end-to-end integration work.

The native build guard refuses the known production API unless `NATIVE_ALLOW_PRODUCTION=1` is explicitly supplied. That opt-in is intended only for a later reviewed release configuration. It is not an instruction to use production for testing. Current guard validation is a configuration check, not proof that an arbitrary non-production host is an isolated backend; verify the project identity.

For CI/configuration smoke tests only, run `NATIVE_SHELL_ONLY=1 npm run native:sync`. This strips Supabase configuration from the compiled bundle, even if a local env file exists. It cannot sign in or serve as a usable beta; it checks bundling and Capacitor sync without touching any database.

## Platform requirements and ownership

The generated Capacitor 8 projects target Android SDK 36 (minimum 24) and iOS 15 or later. Use the current supported Android Studio/Java and Xcode versions from Capacitor documentation; Android debug compilation passed in GitHub CI (see chunk 02); unsigned iOS simulator compilation also passed in chunk 03. Signed physical-device builds and device behavior remain unverified. Android development currently requires Java 21, beyond the available Java 17 installation. iOS requires macOS/Xcode. Keep signing keys and certificates in secure storage owned by the publisher. Do not commit signing files.

The templates still have default Capacitor app icons/splash screens and provisional version identifiers. Replace and review these before beta distribution. Native back navigation handles modal dismissal, Dashboard return and minimising; verify actual platform behaviour on both devices.

## Saving scope

The pending-save journal covers **day workout logs** routed through `saveLog`. It does not make plans, programmes, assessments, group changes or provider integrations fully offline. The journal is local device storage scoped by authenticated user, family, profile and date. It stores unsynced snapshots, not a reward ledger, and removes a snapshot only after its matching write succeeds.

Signing out stops replay and clears in-memory training caches. Pending local drafts remain on that device and can be resumed only after signing back into their owning account. Clearing site/app data removes them. If local storage fails or fills up, the interface warns that the edit is not saved on the device and the app must remain open until sync succeeds.

Day rows retain the existing unique UPSERT key `(family_id, profile_id, date_ymd)` so retries update one day rather than adding rows. XP/reward rules are unchanged. Chunk 02 adds an opt-in versioned server endpoint; the app's existing local revision guards remain in force.

With `VITE_LOG_SYNC_MODE=versioned` and the matching database migration, stale day writes pause for review rather than silently overwriting. Production still uses the legacy path until reviewed rollout. This is day-level conflict handling, not field merging or offline support for every feature. Confirmed account deletion purges this account's drafts on the current device. See chunk 02 for testing and remaining gates.

## Security and dependency maintenance

Capacitor CLI's Xcode parser currently brings an old `uuid` dependency. The scoped `xcode -> uuid 11.1.1` override removes its reported advisory while preserving the parser's CommonJS `v4()` API. Project parsing/UUID generation and Capacitor sync were checked after the override. Recheck or remove the override when the upstream parser is fixed.

Useful primary references checked for this build:
- https://capacitorjs.com/docs/getting-started
- https://capacitorjs.com/docs/getting-started/environment-setup
- https://capacitorjs.com/docs/apis/app
- https://supabase.com/docs/guides/auth/native-mobile-deep-linking
- https://supabase.com/changelog.md
