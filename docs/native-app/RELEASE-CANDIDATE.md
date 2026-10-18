# Workout Tracker release candidate

18 October 2026. Repository: `mrswain69-dotcom/workout-tracker`, draft PR #144. Public site: https://workouttrackerapp.io. Every existing feature remains free. Current native builds use isolated staging; no production rollout or store submission has been performed.

## Completed build work

- Latest main stale-data fix (PR #145, `54342f4`) is integrated. Native resume refreshes day logs, history and verification while protecting pending edits.
- Durable account-scoped day drafts, bounded retries, server version/idempotency checks and explicit conflict review are implemented. The additive migration is installed on staging only.
- Android and iOS projects compile in CI. Configured Android staging uses a separate ID; the iOS simulator build uses the matching staging ID and callback.
- Native launcher/splash assets now derive from the existing orange Workout Tracker mark. Original public artwork is preserved. iOS marketing version is aligned to 0.1.0.
- Native artwork remains lossless, with decoded-pixel checks. The prior pass reduced public assets by 35.4% to about 302 MB; further optimization is desirable, but reducing quality is not required by this build.
- Build metadata records exact commit, source cleanliness, target, version and public API origin. `npm run native:verify` rejects staging bundles containing production endpoints, configured shells, service workers, PWA/dev HTML references and dirty CI builds.
- CI creates APKs, a staging debug AAB for packaging validation, simulator archive, verification reports and an iOS launch screenshot. The simulator smoke check installs and opens a fresh signed-out app; account journeys remain separate tests.

## Verified candidate evidence

Runtime code commit: `c43e06f58451f3681a549773a3302528107973bf`. [Actions run 39081023716](https://github.com/mrswain69-dotcom/workout-tracker/actions/runs/39081023716) passed all four jobs: full tests/web build/audit, Android shell, Android staging and iOS Simulator. The suite passed **1,498 tests across 244 files**; dependency audit reported zero vulnerabilities.

The staging app installed and launched on **iPhone 17 Pro, iOS 26.2 Simulator**. The captured screen was visually inspected: the Workout Tracker account screen rendered its branding, sign-in/signup controls, fields and legal/support links without clipping. [Launch screenshot](evidence/ios-launch.png) and [device/launch metadata](evidence/ios-launch.json) are retained here. This verifies the fresh signed-out screen only, not account creation, credentials, saving or physical-device behavior.

Download the **Workout-Tracker-staging-debug** artifact from that run for direct Android testing. Do not choose the unconfigured shell artifact. Artifacts expire after 14 days; rerun CI at the same commit to reproduce them. Android debug signing can differ between fresh runners, so replacing an earlier test build may require uninstalling it, which deletes local app data; sync supported drafts first. Publisher-controlled signing remains required for stable distribution.

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

The connected page-fetch operation returns **403 at read_protection_bypass** for the preview. Check that the connected Vercel account has access to **Workout Tracker**, project `prj_ERaieRlkiiIZzii54lOFkamPF25t`, team `team_WeE4g53wFbgEM34fbDFaAAmY`, and that the connection authorizes this project/team. The response does not establish which account-side permission is missing. Deployment Protection has not been disabled. A later attempt with the known team scope to create temporary preview access was **rejected by automatic approval review before execution**: a shareable access link permits anyone holding it to open the protected preview. No link was created. Explicit user authorization is required for a short-lived (proposed one-hour) access link before protected browser testing can continue. The earlier 403 and this review rejection are separate blockers; neither proves the connected account is misconfigured.

### 3. Publisher signing

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
