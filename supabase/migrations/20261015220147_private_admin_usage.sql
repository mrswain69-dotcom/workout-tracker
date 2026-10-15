-- Operational usage only: account-level daily foreground visits, no IP/device/page tracking.
create table private.usage_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table private.app_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default ((now() at time zone 'Europe/London')::date),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id,day)
);
create index app_usage_daily_day_idx on private.app_usage_daily(day);
create table private.usage_config (
  singleton boolean primary key default true check(singleton),
  tracking_since timestamptz not null default now()
);
insert into private.usage_config(singleton) values(true);
alter table private.usage_admins enable row level security;
alter table private.app_usage_daily enable row level security;
alter table private.usage_config enable row level security;
revoke all on private.usage_admins, private.app_usage_daily, private.usage_config from public,anon,authenticated;

create function private.usage_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from private.usage_admins a join auth.users u on u.id=a.user_id
    where a.user_id=auth.uid() and u.deleted_at is null
  );
$$;
create function private.usage_record_visit() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and deleted_at is null) then
    raise exception 'Sign in required' using errcode='42501';
  end if;
  insert into private.app_usage_daily(user_id) values(auth.uid())
  on conflict(user_id,day) do update set last_seen_at=now()
    where private.app_usage_daily.last_seen_at < now()-interval '10 minutes';
end;
$$;
create function private.usage_positive(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare text_value text := value #>> '{}';
begin
  if length(text_value)<64 and text_value ~ '^[0-9]+([.][0-9]+)?$' then return text_value::numeric>0; end if;
  return false;
end;
$$;
create function private.usage_has_activity(log jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare b jsonb; sets jsonb; s jsonb; m jsonb;
begin
  if jsonb_typeof(log->'blocks')='array' then
    for b in select value from jsonb_array_elements(log->'blocks') loop
      if b->>'cancelled'='true' or b->>'suspendedByRecoveryMode'='true' then continue; end if;
      if b->>'typeId' in ('strength','hiit','box') and jsonb_typeof(b->'sets')='object' then
        for sets in select value from jsonb_each(b->'sets') loop
          if jsonb_typeof(sets)<>'array' then continue; end if;
          for s in select value from jsonb_array_elements(sets) loop
            if private.usage_positive(s->'reps') or private.usage_positive(s->'timeSeconds') or private.usage_positive(s->'count') or private.usage_positive(s->'distanceKm') or private.usage_positive(s->'durationMin') then return true; end if;
          end loop;
        end loop;
      elsif b->>'typeId'='cardio' then
        if private.usage_positive(b#>'{cardio,distanceKm}') or private.usage_positive(b#>'{cardio,durationMin}') then return true; end if;
      elsif b->>'typeId'='duration' then
        if private.usage_positive(b#>'{duration,minutes}') then return true; end if;
      elsif b->>'typeId'='recovery' then
        if b->>'recoveryDone'='true' or private.usage_positive(b#>'{duration,minutes}') then return true; end if;
      elsif b->>'typeId'='session' then
        if b#>>'{session,completed}'='true' or private.usage_positive(b#>'{session,actualDurationSec}') then return true; end if;
        if jsonb_typeof(b#>'{session,movements}')='array' then
          for m in select value from jsonb_array_elements(b#>'{session,movements}') loop
            if m->>'skipped'='true' then continue; end if;
            if m->>'completed'='true' or (jsonb_typeof(m->'result')='object' and jsonb_path_exists(m->'result','$.** ? (@.type() == "number")')) then return true; end if;
          end loop;
        end if;
      end if;
    end loop;
  else
    -- Older logs used entries rather than blocks.
    if jsonb_typeof(log->'entries')='object' then
      for sets in select value from jsonb_each(log->'entries') loop
        if jsonb_typeof(sets)<>'array' then continue; end if;
        for s in select value from jsonb_array_elements(sets) loop
          if private.usage_positive(s->'reps') or private.usage_positive(s->'timeSeconds') then return true; end if;
        end loop;
      end loop;
    end if;
    if private.usage_positive(log#>'{cardio,distanceKm}') or private.usage_positive(log#>'{cardio,durationMin}') or private.usage_positive(log#>'{custom,durationMin}') then return true; end if;
  end if;
  return false;
end;
$$;

create function private.usage_dashboard(include_admin boolean default false) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare report jsonb; today date := (now() at time zone 'Europe/London')::date;
begin
  if not private.usage_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  with users as (
    select id,email,created_at,email_confirmed_at,last_sign_in_at from auth.users u
    where u.deleted_at is null and not coalesce(u.is_anonymous,false)
      and (include_admin or not exists(select 1 from private.usage_admins a where a.user_id=u.id))
  ), profile_counts as (
    select f.owner_user_id user_id,count(*) filter(where not coalesce(p.archived,false)) profiles,
      bool_or(exists(select 1 from jsonb_each(case when jsonb_typeof(p.plan_json->'blocksByWeekday')='object' then p.plan_json->'blocksByWeekday' else '{}'::jsonb end) d where jsonb_typeof(d.value)='array' and jsonb_array_length(d.value)>0)) planned
    from public.families f join public.profiles p on p.family_id=f.id group by f.owner_user_id
  ), activity as (
    select f.owner_user_id user_id,min(l.date_ymd) first_activity,max(l.date_ymd) last_activity,
      count(*) activity_logs,count(distinct l.profile_id) active_profiles,
      count(distinct l.date_ymd) activity_days,
      bool_or(l.date_ymd >= (today-6)::text) logged7,
      bool_or(l.date_ymd >= (today-29)::text) logged30
    from public.logs l join public.families f on f.id=l.family_id
    where l.date_ymd ~ '^\d{4}-\d{2}-\d{2}$' and l.date_ymd<=today::text and private.usage_has_activity(l.log_json)
    group by f.owner_user_id
  ), visits as (
    select user_id,max(last_seen_at) last_seen_at from private.app_usage_daily group by user_id
  ), accounts as (
    select u.*,coalesce(p.profiles,0) profiles,coalesce(p.planned,false) planned,
      greatest(v.last_seen_at,u.last_sign_in_at) last_seen_at,
      a.first_activity,a.last_activity,coalesce(a.activity_logs,0) activity_logs,coalesce(a.activity_days,0) activity_days,
      coalesce(a.active_profiles,0) active_profiles,coalesce(a.logged7,false) logged7,coalesce(a.logged30,false) logged30
    from users u left join profile_counts p on p.user_id=u.id left join activity a on a.user_id=u.id left join visits v on v.user_id=u.id
  )
  select jsonb_build_object(
    'generated_at',now(),'tracking_since',(select tracking_since from private.usage_config where singleton),
    'summary',jsonb_build_object(
      'accounts',count(*),'verified',count(*) filter(where email_confirmed_at is not null),
      'profiles',coalesce(sum(profiles),0),'active_profiles',coalesce(sum(active_profiles),0),
      'new7',count(*) filter(where (created_at at time zone 'Europe/London')::date>=today-6),
      'new30',count(*) filter(where (created_at at time zone 'Europe/London')::date>=today-29),
      'opened7',count(*) filter(where (last_seen_at at time zone 'Europe/London')::date>=today-6),
      'opened30',count(*) filter(where (last_seen_at at time zone 'Europe/London')::date>=today-29),
      'logged7',count(*) filter(where logged7),'logged30',count(*) filter(where logged30),
      'awaiting_confirmation',count(*) filter(where email_confirmed_at is null),
      'never_signed_in',count(*) filter(where last_seen_at is null),
      'no_profile',count(*) filter(where email_confirmed_at is not null and profiles=0),
      'no_activity',count(*) filter(where activity_logs=0),
      'verified_no_activity',count(*) filter(where email_confirmed_at is not null and activity_logs=0),
      'planned',count(*) filter(where planned),'activated',count(*) filter(where activity_logs>0),
      'inactive30',count(*) filter(where activity_logs>0 and not logged30)),
    'accounts',coalesce((select jsonb_agg(to_jsonb(page) order by page.created_at desc) from (
      select email,created_at,email_confirmed_at,last_seen_at,profiles,planned,first_activity,last_activity,activity_logs,activity_days,logged7,logged30
      from accounts order by created_at desc limit 200) page),'[]'::jsonb),
    'daily_signups',(select jsonb_agg(jsonb_build_object('date',day::date,'count',(select count(*) from users where (created_at at time zone 'Europe/London')::date=day::date)) order by day)
      from generate_series(today-13,today,interval '1 day') day)
  ) into report from accounts;
  return report;
end;
$$;

-- Public API wrappers are invokers; privileged implementations live in the unexposed schema.
create function public.wt_admin_usage_access() returns boolean language sql stable security invoker set search_path='' as $$ select private.usage_is_admin(); $$;
create function public.wt_admin_usage_dashboard(include_admin boolean default false) returns jsonb language sql stable security invoker set search_path='' as $$ select private.usage_dashboard(include_admin); $$;
create function public.wt_record_app_visit() returns void language sql security invoker set search_path='' as $$ select private.usage_record_visit(); $$;
revoke all on function private.usage_is_admin(),private.usage_record_visit(),private.usage_positive(jsonb),private.usage_has_activity(jsonb),private.usage_dashboard(boolean) from public,anon,authenticated;
revoke all on function public.wt_admin_usage_access(),public.wt_admin_usage_dashboard(boolean),public.wt_record_app_visit() from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.usage_is_admin(),private.usage_record_visit(),private.usage_dashboard(boolean) to authenticated;
grant execute on function public.wt_admin_usage_access(),public.wt_admin_usage_dashboard(boolean),public.wt_record_app_visit() to authenticated;
