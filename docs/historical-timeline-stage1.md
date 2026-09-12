# Historical Timeline / Performance Autobiography — Stage 1: Private Age Foundation

## Status

Stage 1 establishes the minimum private data and deterministic age primitives required by the Performance Autobiography. It does not create timeline UI, backfill dates of birth, or rewrite historical records.

## Production migration

Production Supabase migration:

`20260912163033_historical_timeline_stage1_birth_date`

The migration is additive only:

```sql
alter table public.profiles
  add column if not exists birth_date date;
```

`birth_date` is nullable. No existing profile is populated automatically.

Post-migration production verification:

- `profiles.birth_date`: `date`, nullable;
- active/existing profile rows with a birth date: **0**;
- workout logs: **499**, unchanged;
- profile RLS: enabled;
- existing owner-only profile SELECT / INSERT / UPDATE policies remain in place.

The repository migration filename exactly matches the migration version recorded by production.

## Age engine

`src/engine/historicalAgeEngine.js` is the canonical primitive for age-on-date calculations.

It provides:

- strict `YYYY-MM-DD` parsing;
- `calculateAgeOnDate(birthDate, eventDate)`;
- `historicalAgeChapter(birthDate, eventDate)`;
- nullable/future-date validation for profile birth dates.

Age changes on the actual birthday, not on January 1.

Leap-day birthdays are deterministic: in a non-leap year, a 29 February birthday remains the prior age on 28 February and advances on 1 March. The later hardening stage may revisit presentation/legal convention if product requirements change, but the engine will never silently invent a 29 February date in a non-leap year.

Invalid dates and events before birth fail closed to `null` rather than creating a false age chapter.

## Profile write adapter

`src/profileBirthDateDb.js` adds a narrow write adapter:

- validates the date before persistence;
- updates only `birth_date` on the selected `profiles.id`;
- returns only the limited profile fields needed to confirm the change;
- does not touch `plan_json` or workout history.

The user-facing birth-date input will be wired into the Progress/Timeline setup flow when the autobiography UI is introduced. Until then, all production values deliberately remain null. We do not ask users for private profile data before the feature can use it meaningfully.

## Group privacy hardening

Permanent Stage 1 regression coverage scans both:

- `src/groups` Group UI source; and
- all `supabase/functions/group-*` Edge Functions.

`birth_date` is forbidden from both surfaces.

Existing Group server functions continue to request explicit profile fields such as `id,plan_json` for protected calculations rather than serialising whole private profile rows.

## Release-quality gate

The Stage 1 candidate passed:

- **92 / 92 test files**;
- **656 / 656 tests**;
- historical age boundary tests: green;
- Stage 1 privacy/integration tests: green;
- Vite production build: green;
- **706 modules transformed**;
- npm audit: **0 vulnerabilities**.

Final exact-head CI/Vercel verification is repeated after migration-version alignment before Stage 1 is closed.

## Stage 1 acceptance contract

Stage 2 may proceed only if all of the following remain true:

- birth dates are nullable and not guessed/backfilled;
- age chapters use attained age on the event date;
- invalid/missing age evidence fails closed;
- birth dates remain private family data and absent from Groups;
- workout/Assessment/Group history is untouched;
- 499 existing workout logs remain unchanged;
- the timeline remains a derived view over authoritative source history.
