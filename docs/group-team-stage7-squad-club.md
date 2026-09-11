# Group & Team Ecosystem — Stage 7: Squad & Club views

## Status

Implementation contract for Stage 7. Production completion requires the exact-head CI, Supabase Edge Function and Vercel gates described below.

## Source scope

The Future Expansion Roadmap defines Squad & Club Mode for football teams, running groups and school squads with:

- team season tracking;
- Squad PR board;
- team Improvement graph;
- Top 3 spotlight;
- team Consistency badge.

Its goal is team culture, not influencer culture. Stage 7 therefore adds a performance summary to Groups whose `group_type` is `squad` or `club` without creating a social feed, follower mechanics, comments or public athlete profiles.

Private Groups keep the existing Group experience and do not load the Stage 7 team PR service.

## Team season tracking

Stage 7 reuses the exact Stage 6 eight-week season definition rather than creating another calendar:

- 56 days / eight Monday–Sunday weeks;
- anchored to the Monday of the Group competition-start week;
- exact Group competition-start and membership dates still bound individual eligibility.

The Squad/Club view shows the current Season number, week N of 8, collective authoritative XP, participating-athlete count, Team Consistency and Team Improvement.

No new season scoring system or hidden combined team score is introduced.

## Squad / Club PR board

The PR board measures **new comparable training personal-record events achieved during the current eligible eight-week season**.

A personal record requires a previous comparable performance. An athlete's first recorded comparable result establishes a baseline and is not labelled a PR.

Supported training comparisons deliberately mirror the conservative comparable-performance rules already used by the Improvement engine:

- strength / HIIT / box: best-set weighted work where both weight and reps exist, otherwise best reps;
- cardio / run / swim / walk / row / cycle / bike: speed compared only within the same sport and approximate 0.5 km distance bucket.

Unsupported, subjective and recovery data does not create PRs. Assessment results are deliberately excluded from the team PR board in Stage 7 so raw or inferred Assessment performance cannot leak into the cross-family team surface.

Earlier private workout history may be read server-side only to determine whether a current-season result genuinely exceeds the athlete's own prior best. Only PR counts and the latest PR date are returned to Group members.

Ranking is by PR count. Genuine equal PR counts share competition rank. Athletes with zero new PRs remain visible but unranked; zero is not turned into a competitive achievement.

## Team Improvement graph

The graph uses the existing truthful weekly Group Improvement standings from Stage 5: the four completed weeks plus the current week.

Each athlete with a genuine comparable Improvement score contributes **one equally weighted athlete score** to that week's team value:

`Team Improvement = sum(scored athlete Improvement %) ÷ number of scored athletes`

The graph never weights an athlete more heavily because they recorded more exercises, metrics or sessions. Athletes without a comparable score are excluded from that week's average rather than being treated as zero.

The UI shows the number of scored athletes alongside each weekly point so sample size remains visible.

## Team Consistency badge

Team Consistency is built from the current Stage 6 season rows using the underlying evidence totals:

`Team Consistency = total completed planned days ÷ total planned days`

It is **not** an average of member percentages, which would incorrectly give athletes with one planned day the same denominator weight as athletes with many planned days.

If any included season row reports `schedule_unavailable`, Team Consistency fails closed and displays no percentage. Missing historical schedule truth is never guessed.

## Top 3 spotlight

The Stage 7 Top 3 spotlight exposes XP, Consistency and Improvement separately. It reuses the current Stage 6 season ranks rather than inventing another ranking system.

Users can switch among:

- XP;
- Consistency;
- Improvement.

Genuine ties remain genuine ties, including all athletes tied at rank 3. There is no hidden volume tiebreak and no composite MVP formula.

## Privacy boundary

The public team surface remains the Group pseudonym plus selected safe avatar/frame and deliberately aggregated competition evidence.

The team PR response must not expose:

- private Workout Tracker profile name or family identity;
- profile id;
- workout log payloads;
- exercise / movement names;
- weights, repetitions, raw cardio values or raw PR values;
- body weight or age group;
- plan contents;
- readiness / fatigue state;
- Assessment runs or results.

The `membership_id` remains the established Group-scoped row identity used throughout the existing leaderboard surfaces.

## Server boundary

`group-team-pr-board` is a read-only authenticated Supabase Edge Function.

1. A valid JWT is required.
2. The supplied `groupId` + `membershipId` must resolve to the caller's active Group membership through the caller's RLS-scoped client.
3. Only after that proof may privileged reads inspect private log history to calculate personal-record events.
4. Only `squad` and `club` Groups are accepted.
5. The request does not accept a PR count, score, workout value or private profile id.
6. Lifetime logs are explicitly paginated so the PR reference history cannot silently truncate at Supabase's normal row-response limit.
7. The function performs no database insert, update, upsert or delete.

No Stage 7 database migration is required because this stage introduces a live read-only team summary rather than persisted competition state. Existing Stage 3–6 RLS and frozen-period storage remain unchanged.

## UX

For a Squad the panel is titled **Squad View**; for a Club it is **Club View**.

It contains:

- Season N / Week N of 8 progress;
- Team XP and participating athlete count;
- Team Consistency badge with completed/planned-day evidence;
- Team Improvement weekly graph and visible scored-athlete count;
- switchable Top 3 spotlight for XP / Consistency / Improvement;
- Squad/Club PR board with safe identity, PR count and latest PR date;
- explicit team-safe privacy explanation.

The visual treatment follows the existing dark performance system: cyan for interaction, green for progress, gold for prestige and red only for caution. It avoids dominance animation or social-feed mechanics.

## Release-quality closure gate

Stage 7 is complete only when all of the following refer to the same final feature-branch SHA:

1. canonical GitHub CI is green for all tests, production build and security audit;
2. the permanent Stage 7 integration test proves engine parity, membership-before-privileged-read ordering, no browser-authored score, no Assessment access, paginated lifetime history and safe response fields;
3. `group-team-pr-board` is deployed to production and ACTIVE with JWT verification enabled;
4. deployed source is verified against the repository contract;
5. non-mutating production invariants show Stage 7 changed no workout, Assessment, plan or existing Group competition history;
6. Supabase advisors show no new Stage 7 database exposure;
7. matching Vercel exact-head deployment is Ready;
8. exact evidence is recorded on PR #7.

Until those gates pass, this document defines the Stage 7 contract but does not itself mark the stage complete.
