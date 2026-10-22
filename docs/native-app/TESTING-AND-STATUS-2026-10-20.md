# Workout Tracker native candidate — 20 October 2026

## 22 October — Log-page plan discovery, build 4

The Log page now offers Quick build plan, Add a one-off activity and Open full plan beside the selected date. Quick build opens directly on that weekday and its programme week, appends without replacing existing work/results, and returns to the selected log. Date-scoped drafts retain unfinished quick-build entries separately from first-run setup. A short disclosure explains varying weeks and avoids presenting all scheduled activities as optional. Existing versioned-save/conflict controls and native runtime remain intact.

Production change: PR #157. Native integration retains both the conflict-review panel and the new prompt. Android/iOS platform versions advance to build 4. Vite remains 8.2.4; test-tool lockfile patches resolve the current audit advisories. Fresh CI and actual device acceptance are required for this build; earlier build 3 APK does not contain this feature. SMTP credential replacement and real email-link acceptance remain outstanding.

## 21 October device feedback — build 3 follow-up

Android build 2 was installed on a physical Samsung device and its signed-out/signup screens were reviewed by Paul. The staging Auth log at 2026-10-21 08:32:43 UTC confirms that signup failed because SMTP returned `535 Authentication credentials invalid`, not because staging blocks email or because the native callback is invalid. Replace the staging Resend SMTP credential through secure settings entry, then repeat signup and confirmation on the device. No credential was inspected or changed, no email confirmation requirement was disabled, and delivery is not yet accepted.

Build 3 centres all native account-footer controls with shared flex alignment and removes the Support link's default underline, so it matches Privacy and Terms. The mailto destination is unchanged. Build 2 remains the previously tested artifact below; build 3 requires fresh CI and device verification.

Current runtime: `96c6e8f4ab0da3b4a58876fab048b3fb56ecf92d`, draft PR #144. Version 0.1.0, platform build 2. Native remains separate from production; all current features remain free.

## Integrated today

Production main `fb6a6e0341f3e9d8a02aa749ac12e2362a788449` (PRs #149–155) is included. This brings signup names into the first profile; guided activity setup; previous results and planned targets beside logging; safe repetition of previous workouts; concise XP/streak hints; clearer readiness empty states; readable email templates; and Performance Coach above the compact status-coloured workout row, with charcoal emphasis for unstarted work. Recovery/Session fixes, mixed block order, native lifecycle refresh, durable account-scoped drafts and versioned save/conflict handling remain integrated.

Three regression-test selectors were updated to expand the new collapsed workout row before using its controls. No saving, rewards or profile-isolation assertion was removed. Vite was pinned to patched 8.2.4 after the dependency audit identified advisories affecting the previous version.

## Checks completed locally

- Full regression suite: 1,561 passed, zero failed, including onboarding, repeat-without-results, recovery, navigation, pending drafts, conflicts and profile switching.
- Web build passes with Vite 8.2.4. Dependency audit: zero vulnerabilities.
- Configured staging native bundle, Capacitor sync and bundle verification pass after the Vite patch, confirming the isolated backend/callback and absence of production endpoints/PWA worker. Local documentation edits mark the build dirty, so final clean source provenance comes from CI. The clean patched runtime passes all four CI jobs.
- Staging SQL regression passed for versioned saves, exact retry idempotency, stale/legacy writes and family isolation. Fixtures were rolled back. Subsequent counts: zero auth users, zero families, zero logs.

## Build evidence

Fresh run: https://github.com/mrswain69-dotcom/workout-tracker/actions/runs/39507362780

All four jobs passed: full tests/web/native verification/audit, Android shell, configured staging Android APK/AAB, and iOS Simulator compile/install/launch. Use that run's final results and artifacts for this runtime. Earlier artifacts do not contain all today's changes or the Vite patch. Android staging APK artifact `12304517058` and staging AAB/evidence artifact `12303673974` are available for this exact runtime; artifacts expire 3 November 2026. The downloaded APK is 306,593,551 bytes with SHA-256 `ad0384fc695aaa59822c9e16ab3f90f71527596f27890fb2c54e685d0ed8917c`. iOS Simulator artifact `12303894506` and launch evidence `12304932491` are also available. The app installed and launched on iPhone 17 Pro / iOS 26.2 Simulator. Its fresh signed-out screen was visually inspected; [screenshot](evidence/ios-launch-20261020.png) and [launch metadata](evidence/ios-launch-20261020.json) are retained. Compilation and fresh signed-out Simulator launch are separate from physical-device/account acceptance.

## Staging authentication

Only isolated project `relsoshjvfcjcwhzofjs` was changed. Its Site URL and exact redirect allowlist now use `io.workouttrackerapp.app.staging://auth/callback`. Four inherited production web redirects were removed from staging. The production project was not changed. A future staging web origin must be verified and explicitly allowed before browser account-flow testing; do not point staging callbacks at production.

Custom SMTP is already enabled, with smtp.resend.com configured. No SMTP credential was read, copied or changed. Today's accessible signup/invite/email-change/reset templates were saved and previewed through the dashboard. Delivery, expired links and cold/warm confirmation/reset still need actual account/device acceptance; configuration alone does not prove delivery.

The earlier Vercel preview redirects this cloud browser to Vercel login. The current connector cannot locate the known project/deployment, and its scoped project search returns no matching project. No protection was disabled. Verified preview/backend/public-route acceptance remains open; do not assume an old protected preview is isolated or current.

## Install and test

On Android, download **Workout-Tracker-staging-debug** from the fresh run, extract the ZIP and install `app-debug.apk`. The label is Workout Tracker Test, ID `io.workouttrackerapp.app.staging`, version 0.1.0-staging/build 2. This is a separate account database: production credentials and records are not copied. Debug certificates may differ between CI runners; uninstalling an older test build deletes local drafts, so review/sync them first.

Start with a disposable staging account. Complete signup/confirmation, then use the guided builder to add an activity, log multi-digit results, navigate away/back, and reopen the app. Repeat the workout on an empty day and confirm that previous results are shown as reference rather than copied as completion. Check the compact workout row, XP/streak hints and readiness empty state. Then test background/offline/reconnect, two-device conflict review and profile/account switching. Run the full feature/device matrix in RELEASE-CANDIDATE.md before release.

The staging AAB is a packaging artifact, not a store upload. The iOS Simulator ZIP requires a Mac/Xcode Simulator and cannot be installed on a physical iPhone. No signed IPA/TestFlight build is available yet.

## Public submission URLs

The proposed public Privacy, Support and Account Deletion URLs initially returned 404. PR #156 (`7378fd0128adb6d58a2aea22dcb934596d52f3f7`) publishes the already-prepared public routes independently of the native rollout. All five paths `/privacy`, `/terms`, `/cookies`, `/support` and `/delete-account` now return HTTP 200 on workouttrackerapp.io. Browser checks confirm Privacy and the actual deletion instructions/request link render without an account. Seven route tests and the isolated web build pass. These pages reuse the existing legal notices; no new automated deletion endpoint or policy claim was introduced. The support inbox and actual request processing still require operator acceptance.

## Publisher and submission gates

Paul reports Apple enrolment pending and Google organisation identity documents under review, with website verification complete and phone verification still pending. These supersede the earlier 'not started' handover. No store-account settings, agreements or submissions were changed here.

Before submission:

1. Complete real Android and iPhone account/device acceptance, including email delivery, native links, saving/retry/conflict and deletion with disposable accounts.
2. Provision a publisher-owned Android upload key in secure signing storage and Apple team/certificate/profile or approved signing integration. No release private key is generated or retained in this scratch environment.
3. Verify the final production identifier `io.workouttrackerapp.app`, secure release configuration, production migration/feature-flag rollout, backups/rollback and measured signed AAB size. Current native verification deliberately refuses an unreviewed release backend.
4. Complete optional provider callback acceptance, support-inbox operation and actual deletion-request processing. The public URLs are now deployed and checked as recorded above.
5. Confirm audience/age and data declarations, reviewer access and actual release screenshots. Listing copy is in STORE-SUBMISSION.md.
6. Build and validate signed release AAB/IPA from the accepted source, then upload to internal Play testing/TestFlight. Public rollout follows beta acceptance and store review.

No current artifact is represented as store-ready or physical-device-tested. The latest source is ready for continued native acceptance, with the gates above explicit.
