# Historical Timeline / Performance Autobiography — Stage 6 Hardening

Status: Stage 6 hardening candidate on `feature/historical-performance-autobiography`.

## Objective

Stage 6 hardens the Stage 0–5 Performance Autobiography before final release.

The purpose is not to add another feature layer. It is to prove that the historical view remains truthful when source history changes, that age boundaries remain deterministic, that old and new workout formats can coexist, that the private history service retains its ownership boundary, and that the UI remains usable on dense mobile layouts.

## Correction and deletion semantics

The autobiography remains a derived view of current source truth.

Permanent regression coverage now proves that:

- correcting a historical workout changes the evidence the autobiography derives from it;
- deleting the historical source removes the derived event rather than preserving a stale milestone;
- derived age chapter counts, records and Career Summary values are therefore allowed to change when source history changes;
- frozen Group award rows remain separate source evidence and are not reconstructed from present leaderboard state.

No Timeline-derived value writes back into workout history, XP, badges, Assessments, Consistency authority, Group results or challenge authority.

## Same-day deterministic ordering

Multiple genuine events may share one date.

The Historical Event Engine applies stable source ordering before stable event IDs:

1. workout;
2. structured Session;
3. Assessment;
4. frozen Group award;
5. Consistency;
6. Knowledge.

Within the same source family, stable event IDs provide the final deterministic tie-break.

The same input evidence therefore renders in the same order regardless of the order in which source rows are supplied.

## Birthday boundaries

Age chapters remain true birthday-to-birthday periods.

Regression coverage proves that an athlete born on 15 December remains in the previous age chapter through 14 December and enters the next chapter on 15 December.

For example, a 15 December 2014 birth date yields:

- Age 11: 15 December 2025 through 14 December 2026;
- Age 12 starts on 15 December 2026.

No calendar-year shortcut is used.

## Leap-day rule

The Stage 1 leap-day rule remains locked.

For a 29 February birth date:

- in leap years, the age advances on 29 February;
- in non-leap years, the age advances on 1 March;
- no invalid 29 February date is invented for a non-leap year.

This rule is regression-tested across both leap and non-leap examples.

## Legacy / modern history coexistence

Stage 6 proves one autobiography can safely consume genuine history recorded under multiple generations of Workout Tracker without rewriting old records.

Supported coexistence includes:

- legacy `entries` workout history;
- block-based strength/cardio/duration/recovery history;
- structured Session history.

The source format remains visible through the event evidence model. Old legacy records are not backfilled into Session records, and current Plan data is not projected backwards to invent historical movement identity.

## Privacy boundary

The private `historical-timeline-data` Edge Function retains the Stage 5 ownership model:

1. a valid authenticated request is required;
2. the exact requested profile must first be selectable through ordinary profile RLS;
3. privileged historical reads occur only after that exact-profile ownership proof;
4. Group membership reads remain constrained to the owned profile and owned family;
5. private `birth_date` is returned only for that owned athlete;
6. the browser still does not directly read server-only historical authority tables.

Stage 6 adds source-level regression guards around those ownership predicates so a future refactor cannot silently remove the boundary.

## Dense mobile behaviour

The Stage 5 responsive contract is now protected by regression coverage.

On narrow layouts:

- DOB controls stack;
- chapter and section headers stack rather than squeeze horizontally;
- metric/evidence grids retain the compact two-column presentation;
- the age selector remains horizontally scrollable instead of wrapping into an unreadable block;
- existing minimum interaction-target sizing remains intact.

This keeps the autobiography compact enough for the family-first mobile use case without creating a separate mobile information architecture.

## Stage 6 verification result

The first complete Stage 6 hardening candidate, `48c8bf9e06e55fa62a231739032fd8bd5d4aad44`, passed:

- 101 / 101 test files;
- 698 / 698 tests;
- the dedicated six-test Historical Timeline Stage 6 hardening suite;
- production Vite build with 717 modules transformed;
- `npm audit --audit-level=low` with 0 vulnerabilities;
- exact-SHA Vercel deployment.

The architecture-document commit that contains this record must itself pass the same normal CI/Vercel gate before Stage 6 is declared complete.

## Production data rule

Stage 6 introduces no database migration and no production-data rewrite.

The protected production invariants remain:

- historical workout logs are never reformatted or backfilled for the autobiography;
- existing Consistency snapshots are retained;
- completed Assessment history remains untouched;
- frozen Group awards remain untouched;
- birth dates remain nullable and are never guessed.

## Stage 6 acceptance gate

Stage 6 is complete only when the newest exact branch head proves:

- corrections recompute derived history from current source truth;
- deletions remove derived history rather than preserving stale events;
- same-day event ordering is deterministic;
- ordinary birthday chapter boundaries are exact;
- the locked 29-Feb / 1-Mar rule is deterministic;
- legacy, block and structured Session history coexist without rewriting old history;
- authenticated exact-profile ownership remains required before privileged history reads;
- private DOB remains outside Group identity/payloads;
- narrow-mobile autobiography controls and grids retain the locked responsive contract;
- the full test suite passes;
- production build passes;
- security audit reports zero vulnerabilities;
- exact-head Vercel deployment succeeds;
- production historical invariants remain unchanged.

Stage 7 is the final release gate: verify the complete PR against production schema/security state, confirm the deployed Edge Function and migration state, recheck protected production invariants, validate the final exact SHA, and only then release the Historical Timeline / Performance Autobiography to `main`.
