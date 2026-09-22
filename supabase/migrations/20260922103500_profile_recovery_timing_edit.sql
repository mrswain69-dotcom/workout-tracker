-- Workout Tracker recovery-period timing editor.
-- Keeps recovery historical and allows authorised parents to correct start/end timing.

create or replace function public.update_profile_recovery_period_timing(
  p_period_id uuid,
  p_profile_id uuid,
  p_started_on date,
  p_started_at timestamptz,
  p_ended_on date default null,
  p_ended_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_period public.profile_recovery_periods%rowtype;
begin
  select r.* into v_period
  from public.profile_recovery_periods r
  join public.profiles p on p.id = r.profile_id
  join public.families f on f.id = r.family_id
  where r.id = p_period_id
    and r.profile_id = p_profile_id
    and p.archived = false
    and f.owner_user_id = auth.uid()
  for update;

  if v_period.id is null then
    raise exception 'Recovery period not found or not authorised';
  end if;

  if p_started_on is null or p_started_at is null then
    raise exception 'Recovery start date and time are required';
  end if;

  if (p_ended_on is null) <> (p_ended_at is null) then
    raise exception 'Recovery end date and time must either both be set or both be blank';
  end if;

  if p_ended_on is not null and p_ended_on < p_started_on then
    raise exception 'Recovery end date cannot be before the start date';
  end if;

  if p_ended_at is not null and p_ended_at < p_started_at then
    raise exception 'Recovery end time cannot be before the start time';
  end if;

  if p_ended_at is null and exists (
    select 1
    from public.profile_recovery_periods other
    where other.profile_id = p_profile_id
      and other.id <> p_period_id
      and other.ended_at is null
  ) then
    raise exception 'Another active recovery period already exists for this profile';
  end if;

  update public.profile_recovery_periods
  set started_on = p_started_on,
      started_at = p_started_at,
      ended_on = p_ended_on,
      ended_at = p_ended_at,
      updated_at = now()
  where id = p_period_id;

  return jsonb_build_object(
    'period_id', p_period_id,
    'profile_id', p_profile_id,
    'started_on', p_started_on,
    'started_at', p_started_at,
    'ended_on', p_ended_on,
    'ended_at', p_ended_at
  );
end;
$$;

revoke all on function public.update_profile_recovery_period_timing(
  uuid, uuid, date, timestamptz, date, timestamptz
) from public;

grant execute on function public.update_profile_recovery_period_timing(
  uuid, uuid, date, timestamptz, date, timestamptz
) to authenticated;
