-- Historical Timeline / Performance Autobiography — Stage 1
-- Private age foundation only. Additive: no profile values are backfilled and
-- no workout, Assessment, Group, XP or plan history is rewritten.

alter table public.profiles
  add column if not exists birth_date date;
