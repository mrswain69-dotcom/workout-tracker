# Group & Team Ecosystem — Stage 2 Group Membership UX

## Status

Stage 2 is complete on `feature/group-team-ecosystem` and remains inside draft PR #7. The feature branch is not merged to production `main`.

The Stage 1 database foundation is extended with authenticated server actions and the first usable Group UI. No leaderboard scoring, season scoring, challenge scoring, public discovery, feed or follower mechanics are introduced.

## Product behaviour delivered

### Group entry

Groups are opened from a compact overlapping-people icon beside the currently selected athlete name.

This deliberately does **not** add `Groups` as a sixth text item to the primary mobile navigation. The existing `Log | Progress | Plan | Assess | Rewards` navigation is unchanged during Stage 2.

The Group Hub is lazy-loaded so users who do not open Groups do not pay the full Group UI bundle cost on initial app load.

### Selected athlete context

Group actions apply to the athlete currently selected in Workout Tracker. The Group entry control sits beside that athlete identity and the Hub repeats `Group identity for <athlete>` before any Create/Join action.

The family account remains the authenticated authority over its owned profiles.

### Group-specific nickname / pseudonym

The public Group name for an athlete is the membership `nickname`, not the private Workout Tracker profile name.

- nickname is 1–32 characters;
- nickname may differ between Groups for the same athlete;
- active nicknames are case-insensitively unique inside a Group;
- the athlete/family can edit its own Group nickname;
- Group Admins cannot silently rename another athlete's pseudonym;
- the private profile name is not present in the cross-family safe directory.

### Create Group

The active athlete can create:

- Private group;
- Squad / team;
- Club.

Creation accepts a Group name, optional description and the creator's Group nickname. The creator becomes the first Admin.

### Invite flow

Admins can create private invite codes.

Security contract:

- invite secret is generated server-side with 18 random bytes (36 hex characters / 144 bits);
- only a SHA-256 hash of the code is stored;
- the database retains a short non-secret hint for invite management;
- the full plaintext code is returned only by the creation response and displayed in the current UI state for copying;
- invite expiry is bounded to 1–30 days;
- max uses is bounded to 1–20;
- invites can be revoked;
- invite use is row-locked during join so concurrent joins cannot consume the same remaining use incorrectly.

An authenticated account can preview a valid invite before joining. Preview exposes only:

- Group id;
- Group name;
- Group type;
- expiry;
- remaining invite uses.

It does not expose the Group member directory, raw membership ownership, profiles, logs, plans or Assessment history.

### Join Group

Join requires:

- an authenticated family account;
- an owned, active athlete profile;
- a valid invite code;
- the Group-specific nickname/pseudonym.

The server derives `family_id`, avatar and selected frame/glow from the owned profile. The browser cannot author another family's ownership or arbitrary cosmetic identity.

Stage 1 still enforces:

- maximum 20 active athletes;
- one active membership per profile per Group;
- case-insensitive nickname uniqueness.

### Membership controls

Members can:

- view the safe Group member directory;
- edit their own Group nickname;
- leave the Group, subject to final-Admin protection.

Admins can additionally:

- edit Group name/description;
- create and revoke invites;
- promote a member to Admin;
- demote an Admin when another active Admin remains;
- remove members.

The final active Admin cannot be removed, demoted or leave until another Admin exists.

## Safe competitive identity

Group member rows render only the Stage 1 safe identity:

- Group nickname;
- Admin/Member role;
- selected avatar;
- selected cosmetic avatar frame/glow;
- safe membership timing metadata.

The Group directory does not expose:

- private profile name;
- family/profile ownership ids;
- body weight;
- age group;
- `plan_json`;
- raw logs;
- raw Assessment data;
- readiness/fatigue state;
- private notes;
- PIN/auth data.

XP avatars are resolved from the existing avatar configuration. Sport Mastery avatar ids resolve to the existing `/avatars/sport/...` assets. Unknown identities fall back safely.

Dynamic readiness/fatigue avatar state remains private and is not copied to the Group identity.

## Automatic avatar/frame synchronization

Stage 2 adds a private trigger after `profiles.plan_json` updates.

When an owned profile deliberately changes its selected avatar, frame or frame-enabled preference, active Group memberships are updated. The existing Stage 1 membership→directory trigger then mirrors only those safe cosmetic fields into the Group directory.

This avoids exposing the full plan merely to keep leaderboard/member identity current.

## Database server actions

Migration: `supabase/migrations/20260910150000_group_team_stage2_actions.sql`

Applied production migration name: `group_team_stage2_actions`.

Authenticated RPC surface:

- `group_create`
- `group_create_invite`
- `group_preview_invite`
- `group_join`
- `group_update_nickname`
- `group_leave`
- `group_update_details`
- `group_set_member_role`
- `group_remove_member`
- `group_revoke_invite`

Security-definer functions use an empty `search_path` and schema-qualified objects. Execution is revoked from `PUBLIC`/`anon` and granted explicitly to `authenticated` only.

Direct authenticated table writes remain disabled. Reads continue through Stage 1 RLS-protected tables.

## Client architecture

New files:

- `src/groups/groupDb.js` — Group read/RPC client;
- `src/groups/groupIdentity.js` — safe avatar/frame resolver;
- `src/groups/GroupHub.jsx` — Stage 2 Group UI;
- `src/groups/GroupHub.css` — responsive dark-first Group presentation;
- `src/groups/GroupHub.test.jsx`;
- `src/groups/groupIdentity.test.js`;
- `src/groups/groupStage2Integration.test.js`.

`App.jsx` adds only:

- one lazy `GroupHub` import;
- one `showGroups` state;
- one 44×44 people icon beside athlete identity;
- one lazy modal mount.

The existing five text navigation items remain unchanged.

## Verification

### Live RPC integrity

A rollback-only live Supabase fixture exercised:

1. create Group;
2. creator pseudonym + safe-directory mirror;
3. server-generated invite;
4. stored hash rather than plaintext;
5. safe invite preview;
6. second athlete join with independent pseudonym;
7. invite use counter;
8. nickname update;
9. automatic avatar/frame synchronization;
10. Admin promotion/demotion;
11. unauthorized Admin mutation rejection;
12. member removal;
13. final-Admin leave rejection;
14. Group detail update;
15. invite revocation;
16. revoked invite rejection.

The transaction was rolled back. Group tables returned to zero rows.

### Application regression gate

Clean Stage 2 feature head before documentation: `4bb40317a460a14a97e4a0c242cbee98d72cde54`.

Permanent CI #418:

- 62/62 test files passed;
- 500/500 tests passed;
- Vite 8.2.2 production build passed;
- 686 modules transformed;
- npm audit: 0 vulnerabilities;
- Group Hub lazy JS chunk: 12.92 kB / 3.96 kB gzip;
- Group Hub CSS: 8.25 kB / 2.17 kB gzip;
- main JS remains under the Vite 500 kB warning threshold at 480.17 kB / 119.85 kB gzip;
- exact-head Vercel status: success.

## Production data invariant check

After the Stage 2 server migration and rollback-only verification:

- workout logs: 499;
- genuine structured Session logs: 0;
- Assessment runs/results: 0 / 0;
- active Assessment schedules: 2;
- active Development Tags: 10;
- Movement↔Tag links: 44;
- Test↔Tag links: 48;
- Groups / Memberships / Directory / Invites: 0 / 0 / 0 / 0;
- Paul plan hash: `a715c519932be388cebe88722439de8b`;
- Wilf plan hash: `278e036e425e2eeff7b02b417029403f`;
- Xander plan hash: `b3b95dc0668da96dfcfeccdea21b6cfe`;
- `group_team_stage2_actions` is recorded in migration history.

No workout history, Assessment history or existing plan data was rewritten.

## Deliberately deferred

Stage 2 does not yet add:

- Weekly XP leaderboard;
- Consistency leaderboard;
- Improvement leaderboard;
- monthly/seasonal standings or awards;
- squad PR board/team graphs;
- private challenges;
- broader mobile navigation migration;
- Progress `Training | Performance` split.

The Group Hub contains no fake leaderboard placeholders. Competitive views arrive only when their scoring engines are truthful.

## Next — Stage 3

Stage 3 stabilises **Weekly XP** as the first real leaderboard:

- extract the existing athlete XP calculation into one pure tested truth engine;
- use that same truth for athlete UI and secure Group scoring;
- Monday–Sunday period contract;
- server-derived cross-family scores only;
- current-athlete/local-neighbourhood emphasis;
- Top 3 spotlight;
- no arbitrary client-authored scores;
- closed-week result/history contract.
