# Workout Tracker — store submission preparation

18 October 2026. Draft listing material, not a submitted or approved store record. All existing features launch free. Publisher accounts, identifiers, signing and audience declarations still require owner verification.

## Listing copy

Name: **Workout Tracker**

Short description: **Build your training plan, log your workouts and see your progress.**

Full description:

Your training. Your way.

Workout Tracker brings your training plan, daily entries and long-term progress together. Build a weekly schedule around the activities you actually do, combine different training blocks and record extra activity when plans change.

- Plan strength, cardio, timed activities, structured sessions and recovery.
- Record sets, repetitions, loads, distances and durations.
- Save programmes to your library and apply them when you are ready.
- Review training history, personal bests and assessments.
- Earn XP, badges and avatars through your training.
- Join groups and follow shared progress and friendly competition.
- Manage athlete profiles and optional supported activity connections.

Existing features are free. An account and internet connection are required for synchronisation and online features. Supported unsynced workout drafts are retained on the device and retried when connectivity returns; this is not a promise that every feature works offline.

Workout Tracker is a training and progress tool. Readiness and performance information is not medical advice.

## URLs and contact

These routes are implemented on the native feature branch. **Verify public production availability before submission**; do not mark them live based on source code or a local test alone.

| Field | Intended value |
| --- | --- |
| Website | https://workouttrackerapp.io |
| Privacy policy | https://workouttrackerapp.io/privacy |
| Support | https://workouttrackerapp.io/support |
| Account deletion request | https://workouttrackerapp.io/delete-account |
| Terms | https://workouttrackerapp.io/terms |
| Support email | support@workouttrackerapp.io |

The external deletion request is an email workflow requiring a monitored support inbox, ownership verification and processing by the operator. It is not an automated web deletion API. In-app deletion remains the server-authorised, password-confirmed flow.

## Owner information still required

1. Apple Developer / Google Play organisation account readiness, publisher identity and Apple Team ID. Existing legal copy names Swain Digital Ltd; verify it matches store records.
2. Final release app identifiers: proposed `io.workouttrackerapp.app`. Staging `.app.staging` must never be substituted for a production listing.
3. Signing through secure publisher-controlled integration/storage. Do not place credentials or private keys in this document or chat.
4. Intended audience and age declarations, including the actual parent-managed profile use by children. Do not guess the store audience from artwork alone.
5. Final privacy/data declarations reviewed against email/account identifiers, athlete/profile details, body/recovery information, workouts, optional provider data, groups/sharing and account-level usage measurements. No advertising SDK or billing SDK is enabled by this build.
6. Reviewer account and steps, tested against the release backend; keep credentials out of public source. Reviewers need working access to core features, not a blank protected preview.
7. Real-device screenshots for each required store size. Simulator sign-in evidence is development QA, not a complete store screenshot set.
8. Signed production AAB size measurement, device tests, staged migration/feature-flag rollout and rollback approval.

## Review preparation

Use the acceptance matrix in RELEASE-CANDIDATE.md. Test signup/confirmation, password recovery, first blank schedule and first entry before inviting external testers. Verify deletion with a synthetic account, including local drafts and an already-open second session. Verify optional Strava configuration separately on staging; never copy real member activities into a test database.

Store references checked 18 October 2026:

- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/support/offering-account-deletion-in-your-app/
- https://support.google.com/googleplay/android-developer/answer/13327111

These sources inform preparation; they do not establish approval or replace accurate declarations for the final signed build.
