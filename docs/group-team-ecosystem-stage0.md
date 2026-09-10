# Group & Team Ecosystem — Stage 0 Architecture

## Purpose

This phase implements the near-term **Phase 1 — Group & Team Ecosystem** from `WORKOUT TRACKER - FUTURE EXPANSION ROADMAP v1.0`, while preserving the Master Doctrine, System Engine, Rewards & Badges and Brand & Experience rules.

The system remains:

- performance-first;
- family-rooted;
- improvement-first;
- discipline-driven;
- healthy-competition focused;
- lightweight rather than social.

No social feed, followers, public popularity mechanics or vanity engagement loops are introduced.

Production base for this phase: `3ad6810ce1c24af6e1470dc47951345f764aa9ef` (Phase 4 Analysis production release).

## Source requirements being implemented

Roadmap Phase 1 requires:

- small invite-based groups, targeted below 20 athletes;
- Admin / Member roles;
- group seasonal leaderboard;
- group consistency leaderboard;
- group improvement leaderboard;
- team seasonal badge;
- private group challenges;
- squad/club mode for football teams, running groups and school squads;
- team season tracking;
- squad PR board;
- team improvement graph;
- Top 3 spotlight;
- team consistency badge.

The wider doctrine also retains weekly and monthly competitive layers. Leaderboards must allow different kinds of athlete to win through effort, improvement and consistency rather than permanent volume dominance.

## Current production baseline

At the start of this phase:

- authentication is **family-account based**;
- one authenticated account owns one `families` row;
- athlete identities live as `profiles` beneath the family;
- profiles own their own `plan_json`, logs and Assessment history;
- existing RLS restricts `families`, `profiles` and `logs` to the owning authenticated family account;
- there are currently **no** public group/team/leaderboard/invite/season tables;
- selected avatar identity currently lives in profile `plan_json.meta` (`avatarId`, `avatarFrame`, frame enablement, etc.);
- dynamic avatar readiness/behaviour state is derived from private athlete state and is not a public cosmetic selection.

Therefore Group membership is modelled around the **athlete profile**, while authorization remains with the profile's owning family account.

This permits Wilf and Xander-style profiles to enter the same or different groups independently, and permits future squads containing profiles owned by different family accounts without giving children separate authentication accounts.

## Privacy and authorization boundary

Joining the same Group must **never** grant access to another family's raw private data.

A Group member may expose only a deliberately small competitive identity/output surface:

- Group-specific nickname / pseudonym;
- selected avatar;
- selected cosmetic avatar frame/glow/aura;
- group role;
- leaderboard rank;
- approved derived competition scores;
- PB/award/team-summary facts explicitly designed for Group visibility.

The Group nickname/pseudonym is deliberately independent from the private Workout Tracker profile name. The same athlete may choose a different nickname in different Groups without changing their account/profile identity.

A Group member must not gain access to another member's:

- private Workout Tracker profile name;
- raw workout logs;
- full `profiles` row;
- weekly `plan_json`;
- body weight;
- age group;
- private notes;
- readiness/fatigue state;
- raw Assessment results;
- family PIN/security data.

Dynamic avatar behaviour/readiness effects are not shared. Only deliberately selected cosmetics are shared.

### Public competitive identity

Do not make another family's `profiles` row generally readable merely to render a leaderboard.

Create a small group-safe identity surface separate from private profile data. It should contain only the fields required to render a member consistently, such as:

- Group membership identifier;
- Group identifier;
- Group-specific nickname / pseudonym;
- selected avatar ID;
- selected avatar frame/glow ID;
- role;
- safe membership timestamps.

The safe cross-family directory should not expose owning family/profile IDs or the private profile name.

Avatar selection remains controlled by the owning family/profile. The group identity surface mirrors only the safe cosmetic fields.

## Group data model direction

Stage 1 should introduce a migration-backed, RLS-protected model along these lines:

### `groups`

Core group identity and lifecycle.

Candidate fields:

- `id`;
- `name`;
- `created_by_family_id`;
- `created_by_profile_id`;
- `status` / archived state;
- optional group type (`private`, `squad`, `club`);
- created/updated timestamps.

### `group_memberships`

One membership per athlete profile per group.

Candidate fields:

- `group_id`;
- `profile_id`;
- `family_id`;
- `role` (`admin`, `member`);
- Group-specific `nickname` / pseudonym;
- selected cosmetic identity snapshot;
- joined timestamp;
- active/left state.

Rules:

- target maximum 20 active members per group;
- profile cannot be duplicated in one group;
- active nickname is case-insensitively unique within the Group;
- at least one Admin must remain;
- only the owning family can add/remove one of its profiles;
- an athlete/family owns its own Group nickname; an Admin must not silently rename another member's pseudonym;
- Group Admin controls group-level membership/admin actions but does not gain access to members' private training data.

### `group_invites`

Private invitation mechanism.

Requirements:

- high-entropy invite token/code;
- store a hash rather than a reusable plaintext secret where practical;
- creator/admin ownership;
- expiry/revocation support;
- optional maximum uses;
- no public group directory required;
- joining requires an authenticated family account and explicit choice of which owned profile is joining.

### group-safe identity surface

A separate safe identity table/read model is preferred over exposing `profiles` across families.

### competition result/cache tables

Leaderboard history and winner badges require persistent period results rather than client-only ranking. Exact schema is deferred until the scoring engines are locked, but it must support weekly, monthly and 8-week seasonal periods without rewriting old results when current plans/cosmetics later change.

## Competition integrity architecture

Cross-family leaderboards cannot be calculated by granting members access to one another's raw logs.

They also must not trust a browser to submit arbitrary leaderboard scores.

The preferred architecture is:

`private athlete data`
→ `server-authorized deterministic competition engine`
→ `group-safe derived score/result surface`
→ `Group UI`

A secure server-side calculation path (for example a tightly authorized Supabase Edge Function/shared deterministic engine or equivalent protected server path) should compute or refresh derived scores after validating that the requester belongs to the group. Service-role access must never be exposed to the client.

The browser may request a refresh or leaderboard read, but it must not be allowed to author an arbitrary XP/improvement/consistency score.

## Leaderboard truth rules

### Weekly XP

Weekly XP is the first leaderboard to stabilise, matching the roadmap/master-doctrine priority order.

It must use the same underlying XP truth as the athlete experience rather than creating a second incompatible XP economy.

Before implementation, the current `buildXpDebugRows` / `computeXpFromLogs` logic should be extracted into a pure tested engine so the athlete UI and competition calculation consume the same rules.

### Consistency

Consistency is conceptually:

`completed planned days / planned days`

However the current `profiles.plan_json` is mutable and is not sufficient by itself to reconstruct a truthful historical denominator after plans change.

Therefore the Group build must **not** back-calculate historical consistency from today's mutable plan and present it as fact.

Before consistency leaderboards launch, introduce a forward-looking immutable/append-safe planned-day commitment mechanism (or equivalent period snapshot) so missed planned days and completed planned days can be measured truthfully from that point onward.

No fake historical consistency backfill.

### Improvement

Improvement must compare each athlete against their own baseline rather than comparing raw body size, weight lifted or absolute speed between children.

For comparable metrics the conceptual rule remains current-period performance versus a rolling four-week baseline. Unlike units must never be added together.

Composite group improvement must be built from normalized per-metric improvement signals, with equal/fair weighting rules locked before UI work. Assessment PB/improvement may contribute only through explicitly compatible, non-duplicative rules.

No athlete should win an improvement leaderboard simply because they recorded more metric types.

### Periods

- weekly is the primary competitive layer;
- monthly is a broader progress layer;
- seasons are 8 weeks;
- lifetime is legacy/reference only and is not a dominance-first competitive surface.

Closed-period results should remain historically stable.

## Leaderboard UX contract

Competition is a mirror, not a weapon.

Every leaderboard must:

- highlight the current athlete;
- emphasise the athlete's local competitive neighbourhood (person above / self / person below);
- make the Top 3 visible without humiliating lower ranks;
- avoid flashing dominance animations;
- use cyan for interaction, green for progress and gold for genuine prestige;
- keep data serious and readable;
- use the Group nickname/pseudonym rather than leaking the private profile name;
- support selected avatar + selected cosmetic glow/frame beside each athlete name;
- keep distant ranks visually quieter;
- avoid a public social-feed feel.

For small family/friend groups, the full table may still be available because the group is intentionally small, but the visual hierarchy must retain the doctrine's local-position emphasis.

Recommended internal Group views:

- **Overview** — group identity, current season, Top 3 spotlight, current athlete position and current challenge;
- **Leaderboards** — tabs for XP / Improvement / Consistency, with Week / Month / Season period controls where meaningful;
- **Progress** — squad PR board and team improvement graph;
- **Challenges** — private group challenges;
- **Manage** — members, invites and admin controls (Admin only where applicable).

Do not force all of these into the first UI stage; introduce them as their underlying engines become truthful.

## Locked navigation evolution

The following product-owner UX decisions are now recorded as deliberate future integration requirements.

### Group entry point

Do **not** add `Groups` as a sixth text tab to the already crowded mobile primary menu.

When the Group shell becomes usable, add a compact **group/team icon** (several overlapping person silhouettes) in the athlete identity area:

`[athlete avatar/name]  [Group icon]  [family/profile selector]`

On mobile the control may be icon-only with an accessible label and at least a 44 px touch target. Wider layouts may show `Groups` text if space allows.

The Group icon should represent the user's competitive/team layer, not a social inbox.

### Mobile primary navigation target

The longer-term mobile primary navigation target is:

- Log
- Progress
- Rewards

Plan and Assessments are management/setup workflows and should eventually move out of the permanent mobile text navigation once the management shell is ready.

### Settings / Manage target

The existing settings area should evolve into a management surface with internal tabs such as:

- General
- Plan
- Assessments

This migration should happen in a dedicated responsive/navigation stage after the Group shell is stable, not as an unrelated early schema change.

Progress/Assessment CTAs must still be able to open Assessments directly after the navigation move.

### Progress target

When the legacy strength/cardio/body-exercise Stats replacement is ready, Progress should gain two internal sub-tabs:

- **Training** — broader strength, cardio, bodyweight, movement-history and athletic training statistics;
- **Performance** — structured Sessions, Assessments, Development Trends and Assessment Analysis.

Do **not** add these tabs during the early Group build while the legacy Stats replacement is incomplete. Introduce them at the later legacy-Stats parity/revamp stage so `Training` is not an empty or misleading destination.

## Proposed staged build

### Stage 0 — architecture, baseline, privacy and navigation contract

- current phase;
- source/doctrine review;
- production baseline;
- family-auth/profile-membership model;
- privacy boundary;
- avatar/glow identity boundary;
- Group-specific nickname/pseudonym boundary;
- competition truth rules;
- navigation decisions recorded.

### Stage 1 — Group schema, RLS and safe identity foundation

- groups;
- profile memberships;
- Admin / Member roles;
- Group-specific nickname/pseudonym;
- group-safe profile identity;
- invite foundation;
- RLS/authorization tests;
- 20-member enforcement;
- no cross-family raw-data exposure.

### Stage 2 — Group creation, invites and membership UX

- create group;
- invite code/link;
- currently selected owned athlete is the explicit Join/Create identity;
- join/leave/revoke flows;
- Group-specific nickname creation/editing;
- Admin member management;
- avatar + selected frame/glow rendered beside member names;
- empty/one-member/full-group states.

### Stage 3 — Weekly XP leaderboard foundation

- extract/reuse one pure XP truth engine;
- secure server-derived cross-family score path;
- Monday–Sunday week contract;
- current-week table;
- local-position emphasis + Top 3;
- no arbitrary client-authored scores;
- weekly result finalization/history contract.

### Stage 4 — Truthful Consistency leaderboard

- immutable forward-looking planned-day commitment/snapshot mechanism;
- Completed Planned Days / Planned Days engine;
- current-week and closed-week consistency;
- no retroactive fake history;
- consistency leaderboard and badge hooks.

### Stage 5 — Improvement leaderboard

- rolling four-week self-baseline engine;
- metric compatibility and safe percentage rules;
- fair composite weighting;
- no raw-strength/body-size dominance;
- no advantage from merely recording more metric types;
- weekly improvement leaderboard.

### Stage 6 — Monthly + 8-week Season layer and progress awards

- monthly XP / improvement / consistency views;
- 8-week seasons;
- historical closed-period standings;
- Weekly/Monthly/Season winner badge triggers;
- Monthly XP Champion / Most Improved / Most Consistent;
- seasonal equivalents;
- team seasonal badge.

### Stage 7 — Squad & Club performance views

- squad PR board;
- team improvement graph;
- Top 3 spotlight;
- team season tracking;
- team consistency badge;
- group identity presentation suitable for family groups and football/running/school squads.

### Stage 8 — Private Group Challenges

- Admin-created private challenges;
- bounded start/end dates and measurable targets;
- controlled reward pool;
- no farming/open-ended engagement loops;
- challenge completion/team badge integration.

### Stage 9 — Navigation integration, responsive polish and release gate

- Group icon in athlete identity area;
- responsive Group shell;
- execute the planned mobile navigation migration when the management shell is ready: primary `Log | Progress | Rewards`, management `General | Plan | Assessments`;
- preserve direct Assessment CTAs;
- do **not** introduce Progress `Training | Performance` tabs until the legacy Stats revamp has truthful Training content;
- full security/privacy regression;
- brand/family-first density review;
- production release and post-deploy invariants.

## Explicitly deferred beyond this phase

Unless required to support the Group Phase safely, do not pull in:

- coach dashboard / plan assignment;
- public discovery;
- chat/social feeds;
- follower/following mechanics;
- wearable verification;
- monetisation;
- AI coaching;
- full historical athlete timeline;
- legacy Stats replacement itself.

## Stage 0 acceptance gate

Stage 0 is complete when:

1. the production base is confirmed;
2. the absence of existing Group tables is confirmed;
3. family-account auth / athlete-profile membership is locked;
4. cross-family raw-data privacy is non-negotiable;
5. Group nickname/pseudonym is separated from private profile identity;
6. safe avatar/frame competitive identity is separated from private `profiles`/`plan_json` data;
7. Weekly XP → Consistency → Improvement → Monthly/Seasonal → Squad → Challenges ordering is agreed;
8. no fake historical consistency is permitted;
9. the Group icon and later mobile navigation decisions are recorded at the correct implementation stage;
10. the Progress `Training | Performance` split is recorded but deliberately deferred until legacy Stats revamp parity.