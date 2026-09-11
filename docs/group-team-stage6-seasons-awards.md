# Group & Team Ecosystem — Stage 6: Monthly + 8-week seasons and Progress Awards

## Status

Implementation contract for Stage 6. Production completion still requires the exact-head CI, Supabase and Vercel release gates described below.

## Product purpose

Stage 6 gives Groups a longer competitive rhythm without replacing the truthful weekly leaderboards introduced in Stages 3–5.

It adds:

- calendar-month competition views;
- fixed 8-week Group seasons;
- independent XP, Consistency and Improvement standings;
- frozen completed-period results;
- permanent Group Progress Awards for completed periods.

No opaque combined MVP score is introduced. The roadmap mentions season MVP as an example award, but does not define a defensible weighting between XP, Consistency and Improvement. Stage 6 therefore keeps the three truths separate rather than inventing a hidden formula.

## Calendar months

A month is the real calendar month from the first through the final calendar day. It is not a rolling 30-day window.

The current month remains live. Completed months freeze their safe standings and can issue:

- Monthly XP Winner;
- Monthly Most Consistent;
- Monthly Most Improved.

Genuine rank-1 ties receive joint awards. A zero-XP period cannot create an XP winner, a period with no planned days cannot create a Consistency winner, and an athlete without a comparable Improvement score cannot win Improvement.

## Eight-week seasons

A season is exactly 56 days / eight Monday–Sunday weeks.

Season 1 is anchored to the Monday of the Group competition-start week. The exact Group competition-start date still bounds eligibility, so days before the Group genuinely began are never credited even when the season shell began on the preceding Monday.

Subsequent seasons start every 56 days. The UI shows the current `week N of 8`.

Completed seasons freeze their standings and can issue:

- Season XP Champion;
- Season Consistency Champion;
- Season Improvement Champion;
- Season Finisher for athletes with genuine participation evidence.

## Truthful scoring

### XP

Long-cycle XP is calculated by the same authoritative XP engine used by athlete XP and Group Weekly XP. The browser does not supply an XP score.

Only XP inside the member's eligible portion of the period is counted. Group competition start and membership join/leave dates bound eligibility.

### Consistency

Long-cycle Consistency is:

`completed planned days ÷ planned days across the whole eligible period`

It is not an average of weekly percentages.

The Stage 4 Consistency engine selects the schedule snapshot effective on each day, so legitimate plan changes during a month or season are represented truthfully. If historical schedule truth is unavailable for an eligible day, scoring fails closed as `schedule_unavailable` rather than reconstructing the denominator from current plans or logs.

Task-only days and Streak Saver remain excluded under the Stage 4 rules.

### Improvement

Long-cycle Improvement reuses the Stage 5 Improvement engine.

Each athlete is compared with their own locked preceding 28-day baseline for that month or season. Compatible metric percentages are equally weighted; declines count alongside gains; unsafe percentage metrics are excluded; and each metric retains the ±50% outlier cap.

A private period baseline is locked once and reused so later edits to older history cannot silently rewrite the competitive reference point.

## Ranking and ties

XP, Consistency and Improvement are ranked independently. There is no volume tiebreak for equal scores. Genuine equal scores share the same competition rank and all genuine rank-1 ties receive the corresponding completed-period award.

Missing Improvement is `null`, never numeric zero, so an athlete without a comparable score cannot outrank an athlete with a genuine negative Improvement score.

## Frozen history and awards

Completed period rows are stored in `group_period_results` with safe Group identity fields frozen alongside the score evidence.

Awards are stored in `group_progress_awards` and contain only the safe Group competition identity and award evidence. They do not add lifetime XP and do not mutate the app's global badge history.

The private table `profile_period_improvement_baselines` stores only the locked Improvement baselines needed for truthful future recalculation.

## Cross-family security

`group-seasons-awards` follows the same server boundary as the existing Group leaderboard functions:

1. a valid JWT is required;
2. the supplied `groupId` and `membershipId` must resolve to the caller's active membership through the caller's RLS-scoped client;
3. only after that proof may the server use privileged reads to calculate cross-family competition results;
4. request bodies do not accept XP, Consistency, Improvement, planned-day or completed-day totals;
5. raw workout logs, plans, Assessment data and private profile/family identifiers are never returned.

`group_period_results` and `group_progress_awards` have RLS enabled and expose authenticated SELECT only to current members of the relevant Group through `private.current_user_group_ids()`.

`profile_period_improvement_baselines` has RLS enabled and all browser-role privileges revoked; it has no client policy because it is a server-only scoring primitive.

## UX

`Seasons & Awards` appears after weekly Improvement in the Group Hub.

The panel provides:

- Month / 8-week season switching;
- XP / Consistency / Improvement metric switching;
- current and completed-period navigation;
- explicit live versus final status;
- current season week number;
- transparent score evidence;
- Progress Award cards using only Group nickname/pseudonym and safe avatar identity.

## Release-quality closure gate

Stage 6 is complete only when all of the following refer to the same final feature-branch SHA:

1. canonical GitHub CI is green for tests, production build and security audit;
2. the Stage 6 Supabase migration is applied successfully;
3. `group-seasons-awards` is ACTIVE with JWT verification enabled;
4. production RLS/grants and caller-membership isolation are verified;
5. rollback-only or non-mutating invariants prove no protected workout, Assessment or plan history changed;
6. the matching Vercel preview is Ready;
7. exact evidence is recorded on PR #7.

Until those gates pass, this document describes the Stage 6 contract but does not itself mark the stage complete.
