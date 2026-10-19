# Workout Tracker release candidate

Updated 19 October 2026. Repository: `mrswain69-dotcom/workout-tracker`, draft PR #144. Public site: https://workouttrackerapp.io. Every existing feature remains free. Current native builds use isolated staging; no production rollout or store submission has been performed.

## Latest integration — 19 October

Recovery update: runtime `2cad51432d461a1d9388cd5bbbc380bf0a5304a1` integrates main `601ab1a6` (PRs #147/#148). Recommended recovery can be added, focused and completed with persistence after navigation; Sessions remain available. Unstarted planned training pauses only for that date, while recorded work/extras and injury/illness rules are preserved. Native saving/conflict protections remain in place. **248 files / 1,525 tests and the web build passed locally.** No database/Edge Function changes were needed. [Fresh CI checks](https://github.com/mrswain69-dotcom/workout-tracker/pull/144/checks) are queued (use the latest branch run); updated installers remain pending; earlier build evidence below is not evidence for this recovery runtime.

### Earlier candidate evidence

See [today's access and testing guide](TESTING-AND-STATUS-2026-10-19.md). Native runtime `a9baa0b578c1cbb9dd70a5d43548d55677970b08` includes live main `cb12d98` (PR #146): mobile Session sizing and mixed Plan/Log block ordering. Native safe-area, pending-draft and conflict protections are retained. Local validation passed **247 files / 1,517 tests** and the web build. The existing local-hour badge fixture also passed under UTC and Europe/London after making its test timestamp local; product reward rules were unchanged.

[CI run 39271828352](https://github.com/mrswain69-dotcom/workout-tracker/actions/runs/39271828352) passed all four jobs, including Android APK/AAB builds, native-bundle checks, zero-vulnerability audit, and iOS Simulator compile/install/launch. The current [launch screenshot](evidence/ios-launch-20261019.png) was visually inspected; its [metadata](evidence/ios-launch-20261019.json) records the fresh signed-out scope. The detailed prior evidence below remains tied to older commits; use today's guide for current artifacts. Vercel still redirected the controlled browser to login on 19 October, so staging browser/Auth acceptance remains open and no settings were changed in that attempt.

## Previous integration — 18 October, evening

The live PWA release `5fabd632ece7d1669389073b28991845c40a28d3` is merged into the native candidate. It honours cancelled planned blocks while retaining genuine same-day completion requirements. Cancelling every block cannot manufacture consistency credit. All five matching group Edge Functions were deployed to isolated staging with JWT verification retained: XP v32, consistency v11, improvement v9, seasons/awards v31 and challenges v10. Unauthenticated HTTP requests to all five returned 401.

Confirmed account deletion now clears the local Supabase session before the existing draft purge/UI reset. Rejected or unconfirmed deletion preserves the session. Dedicated public `/privacy`, `/terms`, `/cookies`, `/delete-account` and `/support` pages reuse the existing notices and support address. The deletion page offers the existing in-app process and an external email request; it does not automatically delete an account without ownership checks. Vercel rewrites and public footer links are included. These URLs must be checked on the release deployment before entering them in store metadata.

Previous candidate suite: **246 files / 1,511 tests passed**. Runtime commit **`58ec4d8a097364549d5256f5ef5254d91b9ccdf4`** passed all four jobs in [CI run 39149067140](https://github.com/mrswain69-dotcom/workout-tracker/actions/runs/39149067140): full tests/web/native verification/audit, Android shell, Android staging APK/AAB and iOS Simulator compile/install/launch. The audit reports zero vulnerabilities. The current [Simulator screenshot](evidence/ios-launch-20261018-evening.png) was visually inspected and [launch metadata](evidence/ios-launch-20261018-evening.json) is retained; scope is fresh signed-out launch only. This previous run contains **Workout-Tracker-staging-debug**; use the 19 October run above for current testing. Historical candidate evidence below remains tied to its original commit.

Staging SQL regression checks passed: versioned saves/idempotency/stale writers/family isolation, undated programme drafts, programme management, community/report privacy, ordinary-user denial of admin usage access, and group-avatar isolation/main-avatar sync/reset/unlock/owner checks. All fixtures were rolled back. The community fixture initially lacked an `auth.users` row required by its reviewer foreign key; adding synthetic users inside the rollback transaction corrected the harness, without an application/schema change.

Security review found **81 public SECURITY DEFINER functions, none executable by anon**. Reviewed ownership/reviewer helpers use server auth identity, and SQL regression checks exercise representative cross-family boundaries. The 81 advisor notices reflect authenticated execution, which many existing APIs require; they were not suppressed or blanket-revoked. This is a scoped review, not a complete independent security audit. Advisors still report 19 INFO notices for RLS tables with no policy and 81 WARN notices for authenticated SECURITY DEFINER execution. See [RLS guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [privileged-function guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). No schema/grant changes were made by this review.

A local browser smoke test could not run: Chromium was absent and its download did not return an installable archive. Component tests passed for all public support routes, but deployed URL routing and rendered-browser acceptance remain open. The successful native Simulator launch is separate evidence.

## Completed build work

- Latest main stale-data fix (PR #145, `54342f4`) is integrated. Native resume refreshes day logs, history and verification while protecting pending edits.
- Durable account-scoped day drafts, bounded retries, server version/idempotency checks and explicit conflict review are implemented. The additive migration is installed on staging only.
- Android and iOS projects compile in CI. Configured Android staging uses a separate ID; the iOS simulator build uses the matching staging ID and callback.
- Native launcher/splash assets now derive from the existing orange Workout Tracker mark. Original public artwork is preserved. iOS marketing version is aligned to 0.1.0.
- Native artwork remains lossless, with decoded-pixel checks. The prior pass reduced public assets by 35.4% to about 302 MB; further optimization is desirable, but reducing quality is not required by this build.
- Build metadata records exact commit, source cleanliness, target, version and public API origin. `npm run native:verify` rejects staging bundles containing production endpoints, configured shells, service workers, PWA/dev HTML references and dirty CI builds.
- CI creates APKs, a staging debug AAB for packaging validation, simulator archive, verification reports and an iOS launch screenshot. The simulator smoke check installs and opens a fresh signed-out app; account journeys remain separate tests.

## Verified candidate evidence

Historical runtime code commit: `c43e06f58451f3681a549773a3302528107973bf` (superseded by the evening integration above). [Actions run 39081023716](https://github.com/mrswain69-dotcom/workout-tracker/actions/runs/39081023716) passed all four jobs: full tests/web build/audit, Android shell, Android staging and iOS Simulator. The suite passed **1,498 tests across 244 files**; dependency audit reported zero vulnerabilities.

The staging app installed and launched on **iPhone 17 Pro, iOS 26.2 Simulator**. The captured screen was visually inspected: the Workout Tracker account screen rendered its branding, sign-in/signup controls, fields and legal/support links without clipping. [Launch screenshot](evidence/ios-launch.png) and [device/launch metadata](evidence/ios-launch.json) are retained here. This verifies the fresh signed-out screen only, not account creation, credentials, saving or physical-device behavior.

The earlier run also contains a **Workout-Tracker-staging-debug** artifact; use the 19 October guide linked above for current testing. Do not choose the unconfigured shell artifact. Artifacts expire after 14 days; rerun CI at the same commit to reproduce them. Android debug signing can differ between fresh runners, so replacing an earlier test build may require uninstalling it, which deletes local app data; sync supported drafts first. Publisher-controlled signing remains required for stable distribution.

Earlier detailed evidence is retained in chunks 01–03. The candidate remains a development build until the gates below pass.

## Exact outstanding owner/access actions

### 1. Isolated Supabase authentication

Open the Supabase project and select development branch **native-app-foundation**, ref `relsoshjvfcjcwhzofjs`. Do not edit production `chdoyavyydwaewpuzbsb` for this step.

In **Authentication → URL Configuration**:

- Set the staging website URL to the intended test preview URL after access works. The current preview is https://workout-tracker-2xhcf9khp-pauls-projects-9d62e071.vercel.app.
- Add exactly `io.workouttrackerapp.app.staging://auth/callback` to allowed redirect URLs.
- Add the staging web origin/root needed for browser confirmation and reset.

In **Authentication → Email/SMTP** configure test email delivery and sender details, then use synthetic accounts to test signup, confirmation, resend and reset. Do not paste SMTP passwords, service-role keys or access tokens into chat. The public frontend key is already configured. These settings are unavailable through the current Supabase connector, so they have not been changed automatically.

The branch is ACTIVE_HEALTHY, with zero synthetic users/families at the last metadata check. Its original MIGRATIONS_FAILED provisioning marker remains after manual schema recovery. Do not merge/rebase this database branch into production; later apply only reviewed migrations through the release process.

### 2. Vercel protected preview access

Paul authorised a one-hour access link on 18 October. The request was sent with `ttl: 3600` for the known preview deployment and team, but **Vercel returned 403: “You don’t have permission to create the shareable link.”** Listing deployments also returned 403. No link was created and Deployment Protection remains enabled. There is no authenticated Vercel CLI fallback in this environment.

This is now a Vercel API/connection access blocker, separate from the earlier automatic review rejection. Check access for project `prj_ERaieRlkiiIZzii54lOFkamPF25t`, team `team_WeE4g53wFbgEM34fbDFaAAmY`. The response does not establish the exact missing account-side permission. A user-created temporary share link or an explicitly authorised browser fallback can provide another test route; do not disable protection. Permission to create the one-hour link is already granted and need not be asked again.

### 3. Publisher signing

Paul confirmed on 18 October that Apple Developer and Google Play publisher account setup has **not started yet**. Enrolment/verification is therefore an open owner gate, not merely missing signing credentials. Start at https://developer.apple.com/programs/enroll/ and https://play.google.com/console/signup.

Confirm Apple Developer/Google Play account readiness and the publisher team/organization. Signing material stays in secure publisher-controlled storage. Apple Team ID, certificate/profile or approved App Store Connect signing integration is needed for a physical iPhone/TestFlight build. Android needs its publisher-owned upload key for store release. Do not paste private keys into chat.

The iOS simulator archive cannot install on an iPhone. Android debug APKs are for direct device testing. The debug AAB uses the staging ID/debug signing and is a packaging check, not an upload-ready production product.

## Acceptance still required

| Gate | Required result |
| --- | --- |
| Auth | New signup → confirmation → blank schedule → first entry; resend/reset and expired links pass on Android/iPhone/web |
| Saving | Multi-digit entry, date navigation, close/reopen, offline retry and two-device conflict review pass without lost supported drafts or duplicate XP |
| Privacy | Switch/logout/deletion with pending drafts; other accounts never receive the records |
| Features | Plans/programmes, recovery, assessments, rewards/avatars, learning, groups, sharing and Strava match the current live feature inventory |
| Device | Keyboard, safe areas, scrolling, back navigation, background/resume and native links pass on actual devices |
| Backend | Existing privileged RPC advisory review and isolated provider secrets/callbacks complete |
| Store | Final identifiers/signing, privacy/data declarations, intended age audience, reviewer access, screenshots and listings complete |
| Production | Review/apply versioned-save migration, compatible feature flag rollout, backups and rollback before enabling production clients |

A successful simulator launch or compilation does not replace these checks. Current input/day-log tests cover relevant paths; this is not a claim that the complete app has passed physical-device acceptance.

## App size and distribution

Google's Play Console help, checked 18 October 2026, lists a **500 MB base-module compressed download limit** and a non-blocking mobile-data notice above 200 MB. Some older optimization pages still mention 200 MB as a limit. The current debug package is about 306 MB; actual production download size must be measured from the signed AAB by Play Console or bundletool. ZIP size alone is not a store acceptance result.

Reference: https://support.google.com/googleplay/android-developer/answer/9859372?hl=en

## Repeatable build commands

```sh
npm ci
npm test
npm run build
npm run native:sync:staging
npm run native:verify
```

`npm run native:branding` regenerates platform sizes from the existing mark when branding sources change; commit the resulting platform assets before CI builds. `NATIVE_SHELL_ONLY=1 npm run native:sync` remains an unconfigured smoke build. Release configuration and signing must be reviewed separately; no production credentials are supplied by these commands.

## Future billing boundary

No purchases, paywalls or paid entitlement enforcement are enabled. Later paid enhancements must use account-level entitlements independent of logs, competitive XP, earned badges/avatars and group standings. Verified purchases/restoration/expiry/refunds require their own server-authoritative integration and store-rule review when products are actually defined. Avatar Mastery remains deferred.
