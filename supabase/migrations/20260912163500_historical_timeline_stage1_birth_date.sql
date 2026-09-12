-- Historical Timeline / Performance Autobiography — Stage 1
-- Private age foundation only. Additive: no profile values are backfilled and
-- no workout, Assessment, Group, XP or plan history is rewritten.

alter table public.profiles
  add column if not exists birth_date date;

comment on column public.profiles.birth_date is
  'Private family-only date of birth used to derive attained age for the Historical Timeline. Never expose through Group identity or leaderboard payloads.';
