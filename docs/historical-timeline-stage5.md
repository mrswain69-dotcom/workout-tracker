# Historical Timeline / Performance Autobiography — Stage 5 Progress UI

Status: Stage 5 implementation candidate on `feature/historical-performance-autobiography`.

## Objective

Stage 5 turns the tested Stage 0–4 historical truth engines into the first visible Performance Autobiography inside the existing Progress experience.

It does not create a new primary navigation destination and it does not replace existing Training, Assessment Analysis or Development Trends.

## Placement

The autobiography is rendered inside the existing lazy-loaded Progress analysis slice after Assessment Analysis.

The locked mobile navigation remains:

`Log | Progress | Rewards`

No `Timeline`, `History`, `Career` or `Autobiography` primary tab is added.

## Private historical data service

Consistency schedule snapshots are deliberately server-only. Stage 5 therefore does not weaken database grants to make the UI easier.

`historical-timeline-data` is an authenticated Edge Function that:

1. requires a valid JWT;
2. proves ownership of the exact requested athlete profile through ordinary profile RLS;
3. only after ownership proof uses privileged reads for that athlete's effective-dated Consistency snapshots;
4. resolves only that athlete's Group memberships within the owned family;
5. returns only frozen Group awards attached to those membership IDs;
6. returns the owned athlete's `id`, `name` and private `birth_date` for the autobiography;
7. keeps Knowledge explicitly unavailable until a genuine dated Knowledge source exists;
8. performs no writes.

The browser never directly selects from the server-only snapshot or award tables.

## Live log compatibility

The main application maps Supabase workout rows from `log_json` into `{ date_ymd, log }` before giving them to Progress.

Stage 5 permanently extends the Historical Event Engine to accept both:

- raw persistence rows with `log_json`;
- live Progress rows with `log`.

A parity test requires both shapes to generate identical historical events. This prevents a UI-only history layer from silently reporting zero activity while the underlying workout log is valid.

## DOB / age experience

If a date of birth is not yet stored:

- genuine date-based history still works;
- the UI states that exact Age chapters are unavailable;
- the selected athlete can add a private date of birth;
- no age is guessed from `under16`, `adult`, school year, calendar year or current age assumptions.

Saving the date of birth:

- uses the existing family-protected `profiles` table;
- immediately recomputes the local autobiography;
- does not mutate or backfill any workout, Assessment, Consistency or award history;
- removes the DOB form once the true Age chapters are available.

## Age chapter UI

When DOB is available, Progress shows horizontally scrollable age chapters such as:

- Age 10
- Age 11
- Age 12

Each chapter uses birthday-to-birthday boundaries from Stage 3 and shows:

- genuine recorded training days;
- structured Session count;
- recovery days;
- genuine PB / improvement milestone count;
- Strength evidence state;
- Cardio evidence state;
- Assessment evidence state;
- Consistency evidence state.

Evidence states remain explicit. Recorded history is not presented as a trend where comparison is not safe.

## Milestone feed

The feed deliberately avoids becoming a second workout diary. Routine workout days remain represented in chapter totals.

The visible milestone feed can surface:

- genuine compatible strength/cardio improvement moments;
- completed Assessments;
- supported Consistency milestones;
- frozen Group/month/season awards;
- future genuine Knowledge milestones.

Every milestone can expose an evidence drill-down using `View evidence`.

The drill-down retains source-specific facts instead of turning every event into one universal score.

## Career Summary UI

Before three full years of genuine evidence, the Career Summary is visibly in a building state and shows:

- first evidence date;
- latest evidence date;
- deterministic unlock date;
- currently recorded training-day count;
- highest supported workout streak;
- PB / improvement milestone count.

After the Stage 4 three-year gate, the full summary can show:

- training days;
- highest streak;
- PB / improvement moments;
- biggest improvement year using the locked milestone-based method;
- frozen season wins;
- calendar years covered.

The UI explicitly states that lifetime improvement remains metric-specific and does not combine kg, repetitions, seconds and scores into a fabricated percentage.

## Responsive / visual contract

Stage 5 uses the existing dark-first Progress language with restrained:

- cyan for autobiography identity / performance evidence;
- green for Consistency;
- gold for frozen achievements.

Responsive rules include:

- horizontally scrollable age selector rather than wrapping into unreadable rows;
- two-column metric/evidence grids on tablet/mobile;
- compact evidence cards and milestone feed;
- stacked DOB controls on narrow mobile widths;
- minimum 44px DOB/age interaction targets.

## Failure behaviour

If the private history service cannot load:

- Assessment Analysis remains usable;
- ordinary local workout history remains usable;
- Progress displays a non-destructive long-range-history warning;
- no history is fabricated to hide the service failure.

## Privacy

`birth_date` stays family-private.

It is not added to:

- Group identity;
- Group leaderboards;
- public Group payloads;
- challenge payloads.

The historical service returns DOB only after proving that the authenticated family can select the exact requested profile through normal RLS.

## Mutation semantics

The autobiography is a derived view.

Correcting or deleting source history is allowed to change derived chapter counts, PB milestones, Consistency milestones and Career Summary statistics. The timeline does not write those derived results back as permanent XP/badges/Group scores.

Frozen award rows remain frozen source evidence and are never reconstructed from present leaderboard state.

## Stage 5 acceptance gate

Stage 5 is complete only when the newest exact branch head proves:

- raw `log_json` and live mapped `log` row parity;
- true DOB-driven age chapters;
- date-based history remains usable before DOB exists;
- private DOB save unlocks ages without historical backfill;
- supported Consistency milestones appear in the correct age chapter;
- frozen awards remain distinct;
- evidence drill-down is present;
- Career Summary remains three-year gated;
- Knowledge remains `not_available_yet` by default;
- the authenticated history function proves exact-profile ownership before privileged reads;
- the browser does not directly read private historical authority tables;
- no new primary navigation item is introduced;
- full test suite passes;
- production build passes;
- security audit reports zero vulnerabilities;
- exact-head Vercel deployment succeeds;
- the history function is deployed with JWT verification enabled;
- protected production history counts remain unchanged after deployment.

Stage 6 then hardens correction/deletion semantics, same-day ordering, birthday/leap-day boundaries, legacy/structured coexistence, privacy boundaries and dense mobile presentation before final release.
