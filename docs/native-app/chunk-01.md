# First native app build chunk

Date: 17 October 2026. Product: **Workout Tracker**, https://workouttrackerapp.io. Owner: Paul Swain. Scope: audit, day-log reliability, Capacitor foundation and account recovery preparation.

## Audited starting point

- Repository: `mrswain69-dotcom/workout-tracker`, default branch `main`.
- Baseline commit: `f4a9071367e109f19c5d3f53131376bf40515d6f` (PR #143, keeping activity inputs open while entering results).
- Application: Vite 8, React 18, Supabase JS 2.116; Node 24. Existing baseline: **234 test files, 1,447 passing tests**.
- Supabase production: project `chdoyavyydwaewpuzbsb`, Workout Tracker, eu-west-1. Inspected table/security metadata only; no customer records or tokens were needed.
- Vercel: project `prj_ERaieRlkiiIZzii54lOFkamPF25t`, Workout Tracker, linked domains include `workouttrackerapp.io`. Latest observed deployment `dpl_HHDqucNimgZ54iEjcomW551nofP4` was READY. The name-based connector lookup worked; the explicitly team-scoped detail lookup returned 404.
- No Supabase development branch existed. Two create-branch calls failed with `McpServerError: Invalid or expired requestState` before any branch was created. Isolated backend provisioning remains outstanding; do not mark WP01 fully accepted or run synthetic writes against production.

## Feature inventory from current code

| Area | Existing implementation | Position in this chunk |
| --- | --- | --- |
| Parent account and profiles | Signup/confirmation, shared family profiles, age groups, onboarding and account deletion service | Preserved; password reset added; native callbacks prepared |
| Planning | Blank new-user plans, weekly/programme plans, reusable programs, sharing, coaching/assignment tools and drafts | Preserved; not made offline |
| Logging | Strength, cardio, duration, tasks, sessions, recovery/illness, extras and dated history | Day-log pending-save journal and retries added |
| Input focus/navigation | Existing PR #143 focus fix, dated cache and revision protections | Preserved and regression tested |
| Dashboard/progress | Calendar, streaks, trends, personal records, assessments and historical timeline | Preserved; save confirmation updates local history without a full refetch |
| Rewards | XP calculations, badges, sports mastery, avatar configuration, identity/history and frames | Preserved; no reward-rule or threshold changes |
| Groups | Membership/invites, boards/cache, seasons, challenges, group identities and results | Preserved; native invitation return not yet tested |
| Verification | Strava and evidence/verification integration | Preserved; native provider callback needs its own test |
| Learning | Existing app learning/content and related progression code | Preserved; the full future Body Intelligence specification is not certified as implemented |
| Installation | Browser PWA guides and reminders | Preserved for browsers; suppressed in native container |
| Subscriptions | No active platform subscription integration added | All current features remain free; WP05 deferred |

The feature inventory establishes presence, not comprehensive acceptance of every roadmap requirement. Use the existing source specifications and tests when auditing each subsystem in depth.

## Implemented changes

1. Account-scoped durable journal written synchronously before the keystroke debounce. Restore pending day snapshots on the next authenticated load for that user/family and allowed profiles.
2. Retain failed writes; retry on reconnect, visibility/app resume, manual Retry sync and a 15-second foreground interval. Reuse the per-day serial queue and local revisions.
3. Acknowledge only the matching journal token. Older responses cannot remove a newer edit; storage quota failure is surfaced instead of falsely claiming durability.
4. Show “Syncing”, “Saved on this device · waiting to sync”, or a local-storage warning. Add a bounded request timeout; keep failed entries available for retry.
5. Reconcile from the returned UPSERT row. Remove the previous whole-history fetch after every successful save, keeping optimistic inputs stable and reducing request volume.
6. Clear in-memory training state and stop queued replay on sign-out or account change. Keep signed-out drafts scoped to their owner. Add regression coverage for switching accounts.
7. Generate Android/iOS Capacitor projects, pinned runtime/plugins, separate native output, build guard, custom auth callback registration, safe-area handling, keyboard configuration and app-resume/back handling.
8. Prepare signup/resend callback selection, forgot-password email, password-update screen, and cold/warm native auth-link handling. Native sign-in starts at the account form, with Privacy/Terms available, rather than the full marketing page.
9. Suppress native PWA prompts/worker registration; preserve the existing browser experience. Add a native sync smoke check to CI and exclude credentials/build output from git.

## Verification and evidence

Tests use synthetic fixtures and mocked transport, not the live database.

- Final full suite: **240 test files / 1,465 tests passed**.
- Baseline full suite: 234 files / 1,447 tests passed.
- Intermediate full suite: 238 files / 1,459 tests passed.
- Focused recovery/native suite: 5 files / 26 tests passed, including failed save → remount → restore → manual retry, reconnect recovery and account separation.
- Web production bundle and native unconfigured shell bundle built successfully.
- Android/iOS project generation and Capacitor sync completed successfully.
- Xcode project parsed and UUID generation tested after the scoped dependency override.
- Dependency audit: zero vulnerabilities after the override.
- `git diff --check` used to verify patch formatting.

**Not verified:** real Supabase staging writes/RLS behaviour, email delivery/allowlists, signed APK/AAB/IPA compilation, device installation, iPhone/Android runtime behaviour, native provider returns, store review. No native device binary or store-ready release is claimed. No new production schema, auth configuration or data was changed.

## Remaining gates and known limitations

- **WP01 partial:** connect an isolated backend, reconcile migrations, configure test emails/integrations and deploy a branch-specific staging preview. No usable staging URL is available from this chunk.
- **WP02 partial:** server conflict/version policy for concurrent devices and old offline drafts; offline scope for other data; account-deletion draft cleanup; controlled device tests. Current backend whole-day writes remain last-writer-wins.
- **WP03 partial:** install required Android/macOS toolchains; compile, sign and install builds; replace default icon/splash assets; verify external links and native navigation.
- **WP04 partial:** test fresh signup/reset/verification against isolated auth; add verified HTTPS links after signing identities exist; complete invitation/provider return handling.
- **Asset size:** current `public/` is about 447 MB (avatars about 423 MB). Native currently bundles the same assets to preserve content. Optimise delivery/encoding before store distribution; do not silently remove earned artwork.
- **WP05:** define future entitlement/billing boundaries without restricting current free access. No paid products, price points or checkout were configured.
- **WP06–08:** full device beta, store accounts/listings/declarations, final release and live installation links remain outstanding.
- **Privacy review:** reflect the actual pending local-draft lifecycle in the product’s privacy/data notes before wider rollout.

## Next large chunk

Complete isolated backend provisioning and use it to implement a server version/conflict policy for day logs; verify schema and RLS with synthetic family accounts. Then wire native auth/provider/invitation returns against that backend and create installable signed test builds. Paul already has Android/iPhone access and willing testers. Publisher accounts, signing identities and Mac/hosted macOS availability still need confirmation.

## Handoff and rollback

Read this report and the current branch/PR before continuing. Record the final commit and test-build versions in the PR. The changes are additive client/native configuration; no database rollback is required. Reverting this branch restores the prior web client. If reverting after testers use the journal, retain/export their pending drafts first and finish sync under the owning account; an older client does not read the new journal format. Signing keys are not in the repository.
