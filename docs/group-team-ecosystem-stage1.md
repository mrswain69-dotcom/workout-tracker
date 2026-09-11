# Group & Team Ecosystem — Stage 1 Group Foundation

## Scope

Stage 1 introduces the database/security foundation for Group & Team without yet exposing create/join/leave/admin actions in the app.

This stage is intentionally additive and inert to current users. No Group seed rows, leaderboard scores, plan changes, workout-log rewrites or Assessment rewrites are created.

## Locked nickname / pseudonym rule

A Group membership has its own `nickname` (group display name). It is not required to match the athlete's underlying Workout Tracker profile name.

This means one athlete may use different names in different Groups without changing their private profile identity.

Rules:

- 1–32 characters;
- trimmed text with no newline/tab control characters;
- unique within the active Group, case-insensitively;
- stored on the Group membership and mirrored to the safe Group directory;
- the private `profiles.name` field is never exposed cross-family merely to render a Group or leaderboard.

Stage 2 may pre-fill the nickname from the owned profile name for convenience, but the user can choose a pseudonym before joining/creating a Group.

## Migration

Repository migration:

`supabase/migrations/20260910143000_group_team_stage1_foundation.sql`

Applied to live Supabase as migration:

`group_team_stage1_foundation`

The migration was first executed inside a rollback-only dry run and passed before the permanent migration was applied.

## Tables

### `public.groups`

Stores Group identity/lifecycle only:

- private / squad / club type;
- creator family/profile anchors;
- active/archived state;
- 2–20 member limit;
- created/updated timestamps.

No public Group discovery is introduced.

### `public.group_memberships`

Private ownership/membership record:

- Group ID;
- owning family ID;
- athlete profile ID;
- Admin / Member role;
- per-Group nickname/pseudonym;
- selected avatar ID;
- selected cosmetic frame/glow ID and enabled state;
- active / left / removed lifecycle;
- joined/left timestamps.

Raw membership rows remain visible only to the profile's owning family account. They are not the cross-family directory surface.

### `public.group_member_directory`

Deliberately small cross-family safe identity surface.

It contains only:

- membership ID;
- Group ID;
- nickname/pseudonym;
- role;
- selected avatar ID;
- selected cosmetic frame/glow ID and enabled state;
- joined/updated timestamps.

It deliberately omits family/profile IDs and never contains:

- profile name;
- body weight;
- age group;
- plan JSON;
- raw logs;
- readiness/fatigue state;
- raw Assessment results;
- notes;
- PIN/auth/security data.

An internal trigger mirrors only active membership identity into this table. Leaving/removal removes the member from the current safe directory.

### `public.group_invites`

Invite foundation only; Stage 2 will add the authorised create/join/revoke RPCs.

- only a SHA-256-style hex hash is persisted, not the reusable plaintext invite secret;
- a short non-secret hint may be retained for an Admin's invite list;
- expiry, revocation, max-use and use-count fields are present;
- direct Data API writes remain disabled in Stage 1.

## RLS / authorization

All four public tables have RLS enabled.

Stage 1 Data API privileges are deliberately read-only:

- `anon`: no Group-table access;
- `authenticated`: SELECT only on the four Group tables;
- no authenticated INSERT/UPDATE/DELETE grants yet.

Read policies:

- `groups`: visible only when one of the current account's owned athlete profiles is an active member;
- `group_memberships`: raw rows visible only when `family_id` belongs to the authenticated account;
- `group_member_directory`: safe identity rows visible only to active members of that Group;
- `group_invites`: visible only to an active Group Admin.

Private RLS helpers live in the non-exposed `private` schema, use `SECURITY DEFINER`, have an empty `search_path`, have PUBLIC execute revoked, and are executable only by `authenticated`. This follows the Supabase-recommended pattern for breaking recursive membership-policy lookups without exposing the protected table.

## Integrity rules

### 20-member hard cap

A membership trigger locks the Group row before activating a membership and prevents the active member count from exceeding the Group's configured limit (maximum 20).

### Profile/family ownership integrity

A membership can only point at a non-archived profile that genuinely belongs to its stored family ID.

Once a membership exists, its Group/family/profile identity cannot be reassigned by update.

### Duplicate athlete protection

One athlete profile cannot have two active memberships in the same Group.

### Nickname uniqueness

Two active members cannot use the same nickname in the same Group, case-insensitively.

### Last Admin protection

An active Group can never lose/demote/remove its final active Admin through membership mutation.

### Directory mirroring

An active membership automatically creates/updates its safe directory entry. Leaving/removal/delete removes the current directory entry.

## Verification

The final rollback-only integrity test exercised real trigger behaviour and passed:

- 20 active members accepted;
- 21st active member rejected;
- safe directory mirrored all 20 active memberships;
- case-insensitive duplicate nickname rejected;
- final active Admin could not be demoted;
- all fixture rows disappeared after rollback.

Privilege checks passed:

- authenticated direct Group INSERT: false;
- authenticated direct Membership INSERT: false;
- authenticated direct Directory UPDATE: false;
- anonymous Group SELECT: false.

The deployed policy catalogue confirms the four intended SELECT policies are scoped to `authenticated` and use the private account/group/Admin helper sets.

## Production invariant check after migration

Unchanged private production data:

- workout logs: 499;
- genuine structured Session logs: 0;
- Assessment runs: 0;
- Assessment Test results: 0;
- active Assessment schedules: 2;
- active Development Tags: 10;
- Movement/Development-Tag links: 44;
- Test/Development-Tag links: 48;
- Paul plan hash: `a715c519932be388cebe88722439de8b`;
- Wilf plan hash: `278e036e425e2eeff7b02b417029403f`;
- Xander plan hash: `b3b95dc0668da96dfcfeccdea21b6cfe`.

New Group tables remain empty after Stage 1 verification:

- Groups: 0;
- Memberships: 0;
- Safe directory entries: 0;
- Invites: 0.

The migration is recorded in `supabase_migrations.schema_migrations`.

## Stage 1 boundary

Stage 1 does **not** yet:

- create Groups from the app;
- generate invite codes;
- join a profile to a Group;
- change roles/remove members;
- sync avatar changes from the current Rewards UI;
- show the Groups icon;
- calculate XP/Consistency/Improvement leaderboards;
- expose any raw cross-family workout/plan/Assessment data.

These write flows are deliberately held for Stage 2, where they can be implemented as narrow authenticated RPCs rather than broad table-write grants.

## Stage 1 status

Database foundation: implemented and live.

Next: **Stage 2 — Group creation, invite/join/leave/admin UX and safe avatar/nickname identity synchronization.**