# Workout Tracker — access, testing and release status

19 October 2026. Existing features remain free. Native work is on draft PR #144 and has not been merged or released to production.

## Today's changes

Latest recovery integration: live main `601ab1a6e069e3d5904af3861050a49ecbb0ae28` (PRs #147 and #148) is included in native runtime `2cad51432d461a1d9388cd5bbbc380bf0a5304a1`. The recommended recovery button now creates and focuses its block, completion persists after navigation, and removing/cancelling recommended recovery restores unstarted planned training. Recorded work and one-day extras are retained. Sessions remain available, including Sessions previously paused by recommended recovery; injury/illness pauses remain in place. Existing native saving/conflict protections are retained. No database or Edge Function changes were required.

Recovery update validation: **248 files / 1,525 tests passed**, plus the web build. Fresh native build results: https://github.com/mrswain69-dotcom/workout-tracker/pull/144/checks (select the latest run for this branch). Build jobs are queued and updated installers are pending; the artifact IDs and launch evidence below describe the preceding candidate, not this recovery update.

### Earlier candidate evidence

Integrated live main `cb12d98e14516ece42ae675fd2d50e42b68e4a88` (PR #146): long Session names stay within the mobile Plan editor, and mixed Log blocks follow Plan order, including cardio before Sessions and repeated block types. The ordering helper retains existing frozen Session data and one-day extras.

Resolved append conflicts by keeping both the native safe-area/conflict styles and the new Session sizing styles, plus both the pending-draft/conflict tests and mixed-order tests. Existing native saving and cross-device refresh protections are retained. A pre-existing local-hour badge fixture was corrected to create 06:00 in the runner's local timezone; its UTC timestamp was 07:00 in British summer time. Badge rules were not changed.

Local validation: **247 test files / 1,517 tests passed**, including the existing recovery/conflict tests and today's ordering cases. The badge fixture also passed separately under UTC and Europe/London. Web build passed.

Runtime commit: `a9baa0b578c1cbb9dd70a5d43548d55677970b08`.
Build run: https://github.com/mrswain69-dotcom/workout-tracker/actions/runs/39271828352

All **four CI jobs passed**: full tests/web/native-bundle verification/audit; Android shell; configured Android staging APK/AAB; iOS Simulator compile/install/launch. The dependency audit reported zero vulnerabilities. Current [Simulator screenshot](evidence/ios-launch-20261019.png) and [launch metadata](evidence/ios-launch-20261019.json) are retained. The fresh signed-out account screen was visually inspected on iPhone 17 Pro / iOS 26.2 Simulator; this does not verify an authenticated account journey or physical iPhone behaviour.

The Android artifact ZIP is approximately 306 MB. Current artifact IDs: staging APK `12194579983`, staging AAB/evidence `12196007981`, iOS Simulator `12197280222`. They are tied to the exact runtime commit above and expire on **2 November 2026**. Any later documentation-only commit does not change the runtime code in these artifacts.

## What you can use on each device

| Version | Devices | How to access | Scope |
| --- | --- | --- | --- |
| Live web/PWA | Windows/Mac browsers, Android, iPhone/iPad | https://workouttrackerapp.io/ | Existing production service and accounts. It does not contain all native-branch changes. |
| Native Android development app | Android 7/API 24 or later; Paul's Galaxy Fold Z4 is an intended test device | Download **Workout-Tracker-staging-debug** from the linked run | Separate staging backend and account database. Installation and physical behaviour still need testing. |
| iOS Simulator build | Mac with a compatible Xcode/iOS Simulator runtime | Download **Workout-Tracker-staging-ios-simulator** | Development compilation/Simulator launch evidence; cannot install on an iPhone or Windows. |
| Signed iPhone/TestFlight app | Physical iPhone, target iOS 15 or later | Not available yet | Requires publisher enrolment and device/TestFlight signing. |
| Store release | Google Play / Apple App Store | No listing or store install link yet | Requires accepted beta/device tests, signed production builds and store review. |

The public PWA homepage was opened successfully in the browser on 19 October. This is an access check, not a fresh verification of every signed-in production flow. Core native functionality is implemented, but the complete native account/device acceptance matrix has not passed yet.

## Android: install the current test build

1. Open the build run linked above and sign in to GitHub if artifact download requires it.
2. In **Artifacts**, download **Workout-Tracker-staging-debug**. Do not choose **Workout-Tracker-shell-debug**: that deliberately has no backend.
3. Extract the downloaded ZIP. Open `app-debug.apk` on the Android phone. Android may ask you to permit installation from the app opening that file; approve only for this trusted test artifact and restore your preference afterwards.
4. The app is labelled **Workout Tracker Test**, ID `io.workouttrackerapp.app.staging`. Its Android version is `0.1.0-staging` (build 1). It is separate from the production PWA.
5. Start with launch, safe areas, keyboard and navigation checks. Signup/login/data tests require the staging Auth setup below to be completed first. **Your production account and training records are not copied into staging.**

Debug builds are development artifacts with temporary debug signing. If a later build cannot update the installed one because its debug certificate differs, uninstalling the test app may be needed. That deletes local test-app data and pending drafts; sync or review supported drafts before uninstalling. Artifacts expire after 14 days and can be reproduced from the exact source commit.

The staging AAB is a packaging check, not an upload-ready Play release. The signed store version needs publisher-owned signing and final production configuration.

## iPhone and desktop

Use the live PWA URL in a normal browser for current production use. On an iPhone, browser/PWA use is available now; the Simulator ZIP is not an iPhone installer.

For a Mac Simulator check, extract the artifact ZIP, then its inner `Workout-Tracker-staging-simulator.zip`. Open a compatible iOS Simulator in Xcode and drag `App.app` onto the running Simulator. The retained CI launch evidence records the exact runtime tested. This does not require an App Store release.
 A signed iPhone build/TestFlight distribution remains blocked by Apple Developer enrolment and signing. Windows can run the web app and download/transfer the Android APK, but cannot run Apple's iOS Simulator.

## Staging access and account setup still open

Vercel access is not yet verified in the browser used for these checks: it redirected to the login screen on 19 October. The one-hour preview link and browser fallback were authorised earlier, but have not yet resulted in verified preview access. No Vercel/Supabase settings were changed in this step. Previous connector attempts to create the authorised one-hour preview link returned API 403; no link was created. The earlier automatic Google-origin approval block is a separate issue, not proof of a Vercel outage or wrong password.

The isolated Supabase branch is `native-app-foundation`, ref `relsoshjvfcjcwhzofjs`. Before account testing:

- Configure/verify its staging web Site URL and exact allowed native callback `io.workouttrackerapp.app.staging://auth/callback`.
- Configure isolated test email delivery and verify confirmation, resend and reset.
- Verify provider secrets and callbacks in isolation, especially Strava.
- Establish synthetic staging accounts; do not use or copy production records.

These are still open checks, not settings this guide claims have been applied. Do not merge/rebase the manually bootstrapped Supabase branch into production.

## What Paul needs to do

1. Start Apple Developer and Google Play publisher enrolment; both were confirmed not started. Keep company identity, agreements, payments and recovery under your control. Do not paste credentials into chat.
2. Once staging account flows work, install the Android test app on the Fold Z4 and record its Android version and the exact build used.
3. After Apple signing is available, install the signed beta on the available iPhone and record its model/iOS version.
4. Run the short test below, then invite a small group of volunteers. Complete audience/privacy/listing declarations and review the final release before publication.

## Device acceptance sequence

Use disposable synthetic accounts on the isolated backend. Record device, OS, build, result and reproduction steps.

1. Signup → confirmation → blank schedule → first plan and first entry. Test reset/resend/expired links and cold/warm native callbacks.
2. On Tuesday and Wednesday, plan cardio → Session → cardio. Confirm Log order matches; use long Session names in the mobile Plan editor.
3. Enter multi-digit values in strength/cardio/duration/Session inputs. Focus and keypad must stay usable; entries remain visible after date/page changes.
4. Save, background, force-close and reopen. Interrupt connectivity, edit a supported day-log draft, reconnect and confirm the real sync status and retained values.
5. Edit the same day on two devices. Check conflict review, both user choices, subsequent edits and no duplicate rewards.
6. Switch athlete/account, sign out and sign back in. Other accounts must not receive pending drafts or private records.
7. Exercise plans/programmes, recovery, assessments, history/PBs, rewards/avatars, learning, groups, sharing and optional integrations against the current feature inventory.
   For recommended recovery, add the suggested block, mark it complete, navigate away/back, undo completion, and remove it. Confirm unstarted planned training pauses/restores, recorded work remains, and Sessions stay available. Injury/illness pauses should remain unchanged.
8. Verify deletion with a disposable account, including local drafts and an already-open second session. Do not delete a real account for testing.

Plans, programmes, groups, assessments and integrations are not promised to work fully offline. Durable offline retry in this build covers supported day workout logs.

## Release work after acceptance

Publisher signing; verified final app IDs and universal/app links; measured signed production package size; real-device screenshots; monitored support/deletion request inbox; privacy/data/audience declarations; reviewer access; isolated provider acceptance; reviewed production migration/feature flags/backups/rollback. Then submit to the stores and publish store links only when listings are live.

Detailed background: RELEASE-CANDIDATE.md and STORE-SUBMISSION.md in this directory. Source and retained evidence are in GitHub; this guide is not evidence of store approval or completed physical-device testing.
