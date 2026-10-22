# Chunk 03 — stale-data integration and staging platform builds

18 October 2026 (UK). Continues draft PR #144. All existing features remain free. No production database or store release is performed by this chunk.

## Integration and saving

Verified main at `54342f47490f7043f8aa49df9b789ecd405a79cb` (PR #145, stale activity logs and verification). It is already an ancestor of native branch baseline `34586cd17640d82a23236a257956a262ebbd668e`; no second merge or duplicate implementation was needed.

Extended that fix to the Capacitor `wt-app-resume` event. Bringing the native app back now triggers the same bounded log/history and verification refresh used on browser focus/reconnection, in addition to retrying pending saves. A native resume explicitly represents an active app even if WebView visibility has not caught up. Existing pending-edit/read-revision protections remain in force. Regression cases cover multiple days and the next versioned write after a clean refresh on both focus and native resume.

## Native artwork packaging

`prepareNativeArtwork` builds a generated `.native-public` copy. Eligible PNG avatars and badge icons are encoded as lossless WebP, including exact transparent pixels and ICC profiles. Each converted file is decoded and its RGBA pixels compared to the original before replacing the PNG in the native copy. Animated, deep-colour and rotated inputs retain their original files. Conversions that increase size retain the PNG. Other public files are copied, excluding the PWA service worker and web manifest.

The first complete asset pass converted 730 images, from 466,421,583 to 301,535,224 bytes (35.4% reduction across public assets). This remains substantial: app-size optimization is not complete and store packaging limits still require review. No resizing or lossy encoding was introduced.

Vite embeds the generated exact-path map only in native builds. Image rendering resolves packaged paths at the display boundary. Stored avatar identities, XP eligibility, API responses, original public artwork and web paths are unchanged. The web build embeds an empty map. Generated assets are ignored by git; pinned Sharp 0.35.5 and the lockfile make the transform reproducible.

## Configured staging build

`config/native-staging.json` contains only the isolated project's URL/ref and public publishable key. These are intended browser/app values, not credentials with server privileges. Never add secret or service-role keys.

- `npm run native:sync:staging` builds and syncs a bundle pinned to `relsoshjvfcjcwhzofjs`, forces versioned saves, and overrides inherited backend variables.
- `NATIVE_SHELL_ONLY=1 npm run native:sync` remains an unconfigured shell check.
- Android debug builds use `io.workouttrackerapp.app.staging`, label **Workout Tracker Test**, and callback `io.workouttrackerapp.app.staging://auth/callback`. Release ID/scheme remain provisional `io.workouttrackerapp.app`.
- The iOS simulator job overrides the bundle ID to `io.workouttrackerapp.app.staging`; URL schemes follow the bundle identifier. It builds with Xcode on hosted macOS and no signing credentials. The archived simulator app preserves executable permissions.
- CI produces separate Android shell/staging artifacts and an unsigned iOS simulator artifact. The simulator app is for macOS Simulator; it cannot be installed on Paul's iPhone or uploaded to TestFlight.

Build results and exact tested commits are recorded in the PR. Compilation does not establish that every device flow or auth callback works.

## Staging access and remaining gates

The Supabase branch reports ACTIVE_HEALTHY; its original MIGRATIONS_FAILED provisioning marker remains after the documented manual bootstrap. Metadata verified the versioned save RPC exists and zero test families/users are present. No production records were copied. Do not merge/rebase the manually bootstrapped database branch into production.

The protected Vercel preview again returned 403 at `read_protection_bypass`; the connection's access to this project/team requires checking. Protection remains enabled. Do not substitute an older preview as a verified isolated environment. Staging auth management is not exposed by the current connector, so email delivery, site URL and redirect allowlists remain unverified.

Before inviting testers:

1. In the **isolated** Supabase branch's Auth URL Configuration, set the staging website URL and add `io.workouttrackerapp.app.staging://auth/callback`. Keep the production app callback only for a later reviewed release. Configure isolated transactional email and verify confirmation/resend/reset end to end.
2. Correct Vercel connection access for project `prj_ERaieRlkiiIZzii54lOFkamPF25t`, team `team_WeE4g53wFbgEM34fbDFaAAmY`, then test the protected preview. No production permissions or protection settings need broadening for this work.
3. Create synthetic test accounts and verify first-use blank schedule, saves, recovery, deletion and account separation on staging. Live account credentials do not access this separate database.
4. Install the configured debug APK on Android. It uses a debug signing key and is a development build, not a Play release. Avoid sensitive real training records until device/auth checks pass.
5. Confirm Apple publisher/team and signing access for a signed iPhone/TestFlight build. Hosted simulator compilation reduces the local Mac requirement for compilation but does not provide device signing or store enrolment.
6. Verify two-device conflict review, force-close/reopen, background/resume, keyboards, scrolling, avatars and group images. Review existing privileged RPC advisories, integration secrets/callbacks, branded icons/splash and app size before broad beta.

## Rollback

Revert this chunk on the feature branch to restore the earlier native assets/build commands. Native assets are generated; `public/` originals remain intact. No schema rollback is required. Uninstalling the test app clears its local drafts; sync or review them first. Release signing and production data remain outside this chunk.

## Build evidence

Initial code commit `c6e29286eaf59d5fa126cb387f8e0065e5035227` passed all four jobs in [CI run 39079819691](https://github.com/mrswain69-dotcom/workout-tracker/actions/runs/39079819691): tests/web/native smoke, Android shell, configured Android staging, and unsigned iOS simulator compilation. Artifacts are approximately 306 MB (Android) and 304 MB (simulator ZIP), available for 14 days. They are development artifacts, not store submissions.

Local verification passed 243 test files / 1,495 tests, web build, configured native staging sync and a zero-vulnerability npm audit. The generated staging bundle was checked for the staging API/callback, absence of the production API, its artwork map and absence of the service worker. Xcode project parsing confirmed distinct Debug and Release bundle IDs.

Final rendering review hoisted the native artwork map to one module-level object to avoid allocating a large map per image. The generated mapping is sorted to keep output ordering stable across workers. Native targeted tests passed after that refinement; the PR's latest CI run records its platform checks. Simulator compilation is not proof of a successful launch or physical iPhone test.

Final runtime code `5ff161d90859054a626f95832b5b4abf9dbc76ab` is checked in [CI run 39080177699](https://github.com/mrswain69-dotcom/workout-tracker/actions/runs/39080177699). Its full suite, native bundles, Android shell/staging and unsigned iOS simulator compilation passed after the map refinement. Download the configured Android build named `Workout-Tracker-staging-debug`; use the simulator archive only with macOS Simulator. Later handoff/template corrections do not change this tested runtime code.
