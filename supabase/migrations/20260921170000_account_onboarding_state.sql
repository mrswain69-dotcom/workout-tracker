-- New-account onboarding is stored against the family/account so it follows
-- the user between devices. Existing accounts are marked complete and are
-- never interrupted by the new automatic tutorial.

alter table public.families
  add column if not exists onboarding_state jsonb;

update public.families
set onboarding_state = jsonb_build_object(
  'version', 1,
  'status', 'complete',
  'completedAt', now()::text
)
where onboarding_state is null;

alter table public.families
  alter column onboarding_state set default
  '{"version":1,"status":"not_started","step":0}'::jsonb;

alter table public.families
  add constraint families_onboarding_state_is_object
  check (onboarding_state is null or jsonb_typeof(onboarding_state) = 'object')
  not valid;

alter table public.families
  validate constraint families_onboarding_state_is_object;

-- Workout streaks need the same dated plan truth already captured for
-- Consistency. Expose only snapshots belonging to the signed-in owner.
create or replace function public.get_profile_streak_schedule_snapshots(
  p_profile_id uuid,
  p_from_date date default null
)
returns table(effective_date date, schedule_json jsonb)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    join public.families f on f.id = p.family_id
    where p.id = p_profile_id
      and f.owner_user_id = auth.uid()
  ) then
    raise exception 'Profile not available';
  end if;

  return query
  select s.effective_date, s.schedule_json
  from public.profile_consistency_schedule_snapshots s
  where s.profile_id = p_profile_id
    and (p_from_date is null or s.effective_date >= p_from_date)
  order by s.effective_date asc;
end
$$;

revoke all on function public.get_profile_streak_schedule_snapshots(uuid, date) from public, anon;
grant execute on function public.get_profile_streak_schedule_snapshots(uuid, date) to authenticated;
