-- Workout Tracker Phase 1 Sessions
-- Permit owner-scoped UPDATE on movement/tag relationship rows so the
-- db.js idempotent upsert helper is valid under RLS.

create policy movement_development_tags_owner_update
on public.movement_development_tags for update
using (
  exists (
    select 1 from public.families f
    where f.id = movement_development_tags.family_id
      and f.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.families f
    where f.id = movement_development_tags.family_id
      and f.owner_user_id = (select auth.uid())
  )
);
