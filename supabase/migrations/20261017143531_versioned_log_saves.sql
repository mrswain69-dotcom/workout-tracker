-- Additive stage rollout. Enable VITE_LOG_SYNC_MODE=versioned only after this is applied.
alter table public.logs add column row_version bigint not null default 0,
  add column last_write_id text;
create schema if not exists private;

create function private.bump_workout_log_version()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.row_version := 0;
  else new.row_version := old.row_version + 1;
  end if;
  return new;
end $$;
revoke all on function private.bump_workout_log_version() from public, anon, authenticated;
create trigger workout_log_version before insert or update on public.logs
for each row execute function private.bump_workout_log_version();

-- Invoker rights preserve existing RLS; family/profile membership is also checked.
create function public.save_workout_log_versioned(
 p_family_id uuid, p_profile_id uuid, p_date_ymd text, p_log jsonb,
 p_expected_version bigint, p_write_id text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_row public.logs%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_log is null or jsonb_typeof(p_log) <> 'object'
   or p_write_id is null or length(p_write_id) not between 1 and 128
   or p_date_ymd !~ '^\d{4}-\d{2}-\d{2}$'
   or p_expected_version < 0 then
   raise exception 'Invalid workout write' using errcode='22023';
 end if;
 -- Validate the date, not just its shape.
 perform p_date_ymd::date;
 if not exists (
  select 1 from public.profiles p join public.families f on f.id=p.family_id
  where p.id=p_profile_id and p.family_id=p_family_id and f.owner_user_id=auth.uid()
 ) then raise exception 'Training profile unavailable' using errcode='42501'; end if;

 select * into current_row from public.logs
 where family_id=p_family_id and profile_id=p_profile_id and date_ymd=p_date_ymd for update;
 if not found then
  if p_expected_version is not null then
   return jsonb_build_object('status','conflict','row',null);
  end if;
  insert into public.logs(family_id,profile_id,date_ymd,log_json,last_write_id)
  values(p_family_id,p_profile_id,p_date_ymd,p_log,p_write_id)
  on conflict(family_id,profile_id,date_ymd) do nothing returning * into current_row;
  if found then return jsonb_build_object('status','saved','row',to_jsonb(current_row)); end if;
  -- A concurrent first writer won the unique key. Lock its committed row.
  select * into current_row from public.logs
  where family_id=p_family_id and profile_id=p_profile_id and date_ymd=p_date_ymd for update;
 end if;
 if current_row.last_write_id=p_write_id and current_row.log_json=p_log then
  return jsonb_build_object('status','saved','row',to_jsonb(current_row));
 end if;
 if p_expected_version is null or current_row.row_version <> p_expected_version then
  return jsonb_build_object('status','conflict','row',to_jsonb(current_row));
 end if;
 update public.logs set log_json=p_log,last_write_id=p_write_id
 where id=current_row.id returning * into current_row;
 return jsonb_build_object('status','saved','row',to_jsonb(current_row));
end $$;
revoke all on function public.save_workout_log_versioned(uuid,uuid,text,jsonb,bigint,text) from public, anon;
grant execute on function public.save_workout_log_versioned(uuid,uuid,text,jsonb,bigint,text) to authenticated;
