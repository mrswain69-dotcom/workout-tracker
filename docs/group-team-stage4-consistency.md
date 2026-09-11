# Group & Team Ecosystem — Stage 4: Truthful Consistency Leaderboard

Stage 4 adds a Group Consistency leaderboard that rewards discipline against the athlete's planned performance/recovery days rather than raw training volume.

## Truth contract

**Consistency Score = Completed Planned Days ÷ Planned Days**

The score is intentionally narrow:

- Eligible planned blocks: strength, HIIT, box, cardio/run/swim/walk/row/cycle/bike, duration, structured Session and recovery.
- Task-only blocks do not create a Consistency obligation.
- Cancelled blocks do not create a Consistency obligation.
- Streak Saver never converts a missed planned day into a completed Consistency day.
- A planned day is complete only when every eligible planned block for that day has genuine same-day completion evidence.
- A multi-block day therefore counts as one completed planned day, not several points of volume.
- Current-week scoring stops at the current London date; future planned days cannot reduce the live percentage.
- Membership and Group competition-start dates bound eligibility so pre-membership/pre-Group days are not credited or penalised.
- Ranking uses Consistency percentage only. Genuine equal percentages share competition rank; training volume is not a hidden tiebreaker.
- If historical schedule truth is unavailable, scoring fails closed rather than reconstructing a denominator from logs or the athlete's current plan.

## Immutable-enough plan truth

Stage 4 introduces `public.profile_consistency_schedule_snapshots` as a private server-only schedule record.

- Initial snapshots were created from existing plans without modifying those plans.
- A plan update creates/updates a snapshot effective the **following London day**.
- Same-day or past obligations therefore cannot be erased by editing the current plan after the fact.
- Snapshot rows store only the eligible block IDs/types needed for Consistency plus a plan hash; they are not exposed to browser roles.
- Existing workout history is not backfilled or rewritten.

Structured Sessions were also hardened with an explicit `completedAt` timestamp. Reopening clears that completion timestamp, and a later re-completion receives a new timestamp. This prevents a Session eventually completed on another day from masquerading as completed on its original planned date.

## Server scoring and privacy

`group-consistency-leaderboard` is the authoritative scorer.

- The client sends Group ID, membership ID and optional reference date only.
- Supabase platform JWT verification is enabled.
- The function additionally validates the user token and proves an active Group membership with the caller's RLS-scoped client **before** privileged cross-family reads.
- Only then does the server read membership data, private schedule snapshots and private workout logs required to calculate the standings.
- Browser-supplied percentage, planned-day or completed-day values are never trusted.
- Raw plans, raw logs, profile IDs and family IDs are not returned in leaderboard payloads.
- Returned competition identity is limited to the Group pseudonym plus selected safe avatar/frame state and score evidence.

Completed historical weeks are frozen into `public.group_weekly_consistency_results`. This table has RLS enabled; `authenticated` has SELECT only and only for Groups returned by `private.current_user_group_ids()`. `anon` has no SELECT and browser roles have no INSERT/UPDATE/DELETE rights.

## UX

Consistency is rendered in the Group Hub directly after Weekly XP and before member management.

- `This week` shows live standings through due days only.
- `Last 4 weeks` exposes the four previous completed Monday–Sunday periods when truthful schedule evidence is available.
- Top 3 spotlight is retained, including every athlete tied at rank 3.
- Current athlete and immediate neighbours remain visually emphasised.
- Group pseudonym + selected avatar/frame/glow remain the athlete identity.
- Each score shows its evidence, for example `3 / 4 planned days`, rather than presenting an unexplained percentage.
- Empty/not-started/no-planned-day states are deliberate rather than fabricated.
- Explanatory copy states that Consistency rewards following the plan, not doing the most work.

## Verification

### Automated regression gate

Implementation head `d53d9036c36fa757ec79ded79e1698f302691f88` passed permanent Workout Tracker CI run `34509400557` (#474):

- 71 / 71 test files passed
- 542 / 542 tests passed
- Vite 8.2.2 production build passed
- 692 modules transformed
- main JS 498.22 kB / 124.07 kB gzip
- npm audit: 0 vulnerabilities
- exact-head Vercel status: success

The main JS chunk remains below Vite's 500 kB warning threshold but is close enough to remain a later navigation/performance watch item.

### Live database migration and security checks

Migration `group_team_stage4_consistency` applied successfully to production.

Post-migration checks confirmed:

- `profile_consistency_schedule_snapshots`: RLS enabled, no SELECT for `anon` or `authenticated`.
- `group_weekly_consistency_results`: RLS enabled; `authenticated` SELECT only; no authenticated INSERT/UPDATE/DELETE; no `anon` SELECT.
- Group-member SELECT policy is present and scoped through `private.current_user_group_ids()`.
- `profiles_consistency_schedule_snapshot_trigger` is active.
- Three initial private schedule snapshots exist and all three stored plan hashes match the unchanged current plans.

Rollback-only fixtures confirmed:

1. Updating Paul's plan inside a transaction generated a next-day Consistency schedule snapshot; rollback restored the exact original plan hash and removed the fixture snapshot.
2. An authenticated user who genuinely owned the fixture Group membership could see the fixture frozen Consistency result through RLS.
3. An unrelated authenticated identity saw zero rows from that same fixture Group.
4. Both fixtures rolled back fully; no Group, membership or Consistency result fixture rows remained.

### Edge Function deployment

Production `group-consistency-leaderboard` is ACTIVE version 1 with `verify_jwt=true`.

The deployed `index.ts` and `consistencyEngine.js` were retrieved after deployment and match the source-controlled Stage 4 implementation. The pure browser/server Consistency engine parity is also protected by automated integration tests.

## Protected production invariants

After migration, deployment and rollback fixtures:

- workout logs: 499
- structured Session logs: 0
- Assessment runs/results: 0 / 0
- active Assessment schedules: 2
- active Development Tags: 10
- Movement↔Tag links: 44
- Test↔Tag links: 48
- Paul plan hash: `a715c519932be388cebe88722439de8b`
- Wilf plan hash: `278e036e425e2eeff7b02b417029403f`
- Xander plan hash: `b3b95dc0668da96dfcfeccdea21b6cfe`
- Groups / memberships / directory / invites: 0 / 0 / 0 / 0
- Weekly XP result rows: 0
- Weekly Consistency result rows: 0
- private Consistency schedule snapshots: 3, all matching current plan hashes

No workout history, Assessment history or existing weekly plan was rewritten.

## Deliberate historical limitation

Stage 4 does **not** pretend to know historical planned schedules from before the schedule-snapshot system existed. Where a period predates reliable schedule truth, the scorer returns schedule unavailable / no standings instead of reverse-engineering an obligation from workout logs or applying today's plan backwards.

That limitation is intentional and is part of the truthful scoring contract.

## Stage status

Stage 4 implementation, live migration, RLS fixtures, Edge deployment and regression checks are complete. The final closure gate is the permanent CI + exact-head Vercel verification on the clean documented branch head containing this file.

Next: **Stage 5 — truthful Improvement leaderboard.**
