# Group & Team Ecosystem — Stage 3 Weekly XP

## Purpose

Stage 3 introduces the first truthful cross-family competition surface: **Weekly XP**.

Weekly XP is the standard Group leaderboard because it reflects the XP economy athletes already see in Workout Tracker. It does not create a second Group-specific XP formula and it does not expose another family's raw logs, plan, Assessment data or private profile identity.

Stage 3 remains inside draft PR #7 on `feature/group-team-ecosystem`. It must not be merged to production `main` until the wider Group & Team Ecosystem release gate is deliberately executed.

## UX contract

### Standard view — This Week

The default Group competitive view is **This Week**:

- Monday through Sunday;
- current week remains live while activity is still being recorded;
- Top 3 receive a compact spotlight;
- the current athlete is clearly identified;
- the athlete immediately above and below the current athlete receive additional local-neighbourhood emphasis;
- distant ranks remain visually quieter;
- ties share the same competition rank;
- the Group nickname/pseudonym and selected safe avatar/frame are used instead of private profile names.

### Historical view — Last 4 Weeks

A compact pill toggle switches between:

- `This Week`;
- `Last 4 Weeks`.

`Last 4 Weeks` means the **four completed Monday–Sunday weeks immediately before the current week**. It is a weekly-history browser, not a new 28-day XP scoring formula. The user can move between those four completed weekly standings.

This distinction preserves the meaning of Weekly XP and avoids mixing an unfinished current week into historical comparison.

## Group Admin scoring-history setting

Stage 3 adds a Group Admin setting controlling how far back Weekly XP may use a member's eligible activity:

### Since Group started — default

Only activity whose `date_ymd` is on or after the Group's exact competition start date is eligible.

If a Group starts on a Thursday, activity from the Monday–Wednesday immediately before creation is not retroactively credited to that Group.

The cutoff is Group-level rather than membership-join-level: an athlete who joins later can still have eligible activity from the Group start onward, matching the requested `since the group started` rule.

### All eligible history

Weekly history may use the athlete's eligible Workout Tracker history before the Group was created.

This setting changes only the safe derived leaderboard result. It never grants Group members access to the underlying private history.

The setting is Admin-only and is changed through a narrow authenticated RPC. Direct Group table writes remain disabled.

## One XP truth

The existing athlete XP calculation currently lives inside `App.jsx`. Stage 3 extracts it to a pure tested engine and makes both:

- the athlete XP display / Rewards XP ledger; and
- server-side Group Weekly XP

consume the same deterministic rule set.

Rules retained include:

- strength-set XP;
- cardio time and distance XP;
- casual walk multiplier;
- duration XP;
- structured Session completion XP;
- recovery XP;
- task XP;
- workout-block completion XP;
- strength/cardio progression bonuses;
- day-complete XP;
- streak milestone XP;
- daily challenge claim XP;
- claimed badge / Sport Mastery avatar XP on claim date.

No browser-supplied `weekly_xp` value is trusted.

## Secure cross-family calculation

The browser cannot read other members' logs or plans and cannot submit arbitrary Group scores.

The Stage 3 flow is:

`private logs + private plan/reward state`
→ `JWT-authenticated server function`
→ `shared deterministic XP engine`
→ `safe Weekly XP result rows`
→ `Group leaderboard UI`

The server function first validates that the requesting authenticated account owns an active membership in the requested Group. Only then may its server-only credential read the raw member data required for scoring.

The response contains only Group-safe competition output such as:

- membership identifier;
- Group nickname;
- selected avatar/frame;
- XP;
- rank;
- week boundaries;
- live/frozen state.

It must not return family IDs, profile IDs, private profile names, raw logs, plans, Assessment results, readiness/fatigue state, body data, notes or auth data.

## Closed-week stability

Completed weekly standings are persisted as safe result snapshots. A frozen result stores the safe identity used for that historical standing together with its XP, score-version, scope mode and Monday–Sunday period.

This prevents later nickname/avatar changes from rewriting how a closed result originally appeared and provides a stable historical record for the four-week browser.

The live current week is recalculated from the current underlying data and is not presented as frozen.

History-scope modes are snapshotted independently so switching between `Since Group started` and `All eligible history` does not overwrite an already frozen result produced under the other mode.

## Competition-window contract for future Challenges

Stage 3 deliberately separates **date-window mechanics** from **XP scoring mechanics**.

A competition window is defined by:

- start date;
- end date;
- scoring rule / goal type;
- live or frozen state;
- scoring-version/provenance.

Weekly XP supplies fixed Monday–Sunday windows.

A later Group Challenges stage can reuse the same window contract so an Admin can:

1. choose a Challenge start date;
2. choose a finish date;
3. choose a goal from a controlled predefined list;
4. let the Challenge update while active;
5. freeze the result when the finish date passes;
6. retain the completed Challenge under the Group's `Challenges` history.

Stage 3 does **not** launch Challenge creation yet. It establishes the period/freeze architecture needed to implement it cleanly later.

## Data additions

Stage 3 adds:

- Group XP history-scope setting;
- immutable Group competition start date;
- a safe `group_weekly_xp_results` closed-period result surface;
- Admin RPC for XP history scope;
- JWT-protected Group Weekly XP server function.

No existing workout, Assessment or plan history is rewritten.

## Ranking rules

For each weekly window:

1. higher XP ranks first;
2. equal XP receives the same competition rank;
3. tied rows are ordered deterministically by Group nickname for display only;
4. a tie does not receive an artificial winner/loser ordering.

Top-3 spotlight is position based and may therefore contain more than three athletes when a tie genuinely spans a Top-3 rank.

## Stage 3 release gate

Before Stage 3 is marked complete:

- pure XP engine tests must cover the existing XP buckets and period helpers;
- athlete App must consume the extracted engine rather than the embedded duplicate calculation;
- secure server result must be source-controlled and deployed with JWT verification;
- history-scope mutation must be Admin-only;
- current week and prior-four-completed-week contracts must be tested;
- Group leaderboard UI must test Top 3, self, neighbours, ties and the period pills;
- complete repository tests/build/audit must pass;
- exact-head Vercel status must be green;
- protected production invariants must remain unchanged apart from the additive Stage 3 schema/function deployment;
- rollback-only Group fixtures must leave no production Group/member/score rows behind.
