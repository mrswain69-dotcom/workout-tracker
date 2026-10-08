-- Creator identity is independent of programme pricing. Private evidence is never public.
create table public.training_program_creators (
 id uuid primary key references public.profiles(id) on delete cascade,
 display_name text not null check(char_length(btrim(display_name)) between 2 and 100),
 headline text not null default '' check(char_length(headline)<=160),
 bio text not null default '' check(char_length(bio)<=3000),
 experience text not null default '' check(char_length(experience)<=3000),
 years_experience integer check(years_experience between 0 and 80),
 role text not null default 'community' check(role in ('community','coach','pt','physio','athlete','club')),
 categories text[] not null default '{}', tags text[] not null default '{}',
 qualifications jsonb not null default '[]' check(jsonb_typeof(qualifications)='array' and jsonb_array_length(qualifications)<=20),
 website text not null default '' check(website='' or website ~ '^https://[^[:space:]]+$'),
 photo_path text not null default '',
 published boolean not null default false,
 credential_revision integer not null default 1,
 verified_revision integer,
 verified_at timestamptz,
 verified_summary text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.training_program_creators enable row level security;
revoke all on public.training_program_creators from public,anon,authenticated;
grant select on public.training_program_creators to authenticated;
create policy creator_visible on public.training_program_creators for select to authenticated
 using(published or private.training_program_target_visible(id,null));

create table private.creator_reviewers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table private.creator_reviewers enable row level security;
revoke all on private.creator_reviewers from public,anon,authenticated;
create function private.creator_is_reviewer() returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from private.creator_reviewers where user_id=(select auth.uid()));
$$;
revoke all on function private.creator_is_reviewer() from public,anon;
grant execute on function private.creator_is_reviewer() to authenticated;
create function public.creator_review_access() returns boolean language sql stable security definer set search_path='' as $$ select private.creator_is_reviewer(); $$;
revoke all on function public.creator_review_access() from public,anon;
grant execute on function public.creator_review_access() to authenticated;

create table private.creator_verification_requests (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references public.training_program_creators(id) on delete cascade,
 credential_revision integer not null,
 snapshot jsonb not null,
 evidence_paths text[] not null default '{}',
 statement text not null check(char_length(statement) between 10 and 3000),
 status text not null default 'pending' check(status in ('pending','approved','changes_requested','rejected','superseded','revoked')),
 reviewer_id uuid references auth.users(id) on delete set null,
 review_note text not null default '',
 created_at timestamptz not null default now(), reviewed_at timestamptz
);
create index creator_requests_creator_idx on private.creator_verification_requests(creator_id,created_at desc);
create index creator_requests_reviewer_idx on private.creator_verification_requests(reviewer_id);
create unique index creator_requests_one_pending on private.creator_verification_requests(creator_id) where status='pending';
alter table private.creator_verification_requests enable row level security;
revoke all on private.creator_verification_requests from public,anon,authenticated;

create function public.creator_save_profile(p_profile_id uuid,p_details jsonb)
returns public.training_program_creators language plpgsql security definer set search_path='' as $$
declare row public.training_program_creators; previous public.training_program_creators; q jsonb; cats text[]; labels text[]; photo text;
begin
 if not private.training_program_target_visible(p_profile_id,null) then raise exception 'Profile access required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_profile_id::text, 80421));
 select * into previous from public.training_program_creators where id=p_profile_id for update;
 if jsonb_typeof(p_details) is distinct from 'object' then raise exception 'Profile details required'; end if;
 if jsonb_typeof(coalesce(p_details->'qualifications','[]'))<>'array' or jsonb_array_length(coalesce(p_details->'qualifications','[]'))>20 then raise exception 'Choose up to 20 qualifications'; end if;
 for q in select value from jsonb_array_elements(coalesce(p_details->'qualifications','[]')) loop
  if jsonb_typeof(q)<>'object' or jsonb_typeof(q->'name') is distinct from 'string'
    or (q ? 'issuer' and jsonb_typeof(q->'issuer')<>'string') or (q ? 'reference_url' and jsonb_typeof(q->'reference_url')<>'string') or char_length(btrim(coalesce(q->>'name',''))) not between 2 and 160
    or char_length(coalesce(q->>'issuer',''))>160 or char_length(coalesce(q->>'reference_url',''))>500
    or (coalesce(q->>'reference_url','')<>'' and q->>'reference_url' !~ '^https://[^[:space:]]+$')
    or q - array['name','issuer','reference_url'] <> '{}'::jsonb then raise exception 'Enter qualification name, issuer and an optional HTTPS reference'; end if;
 end loop;
 select coalesce(array_agg(btrim(value)),'{}') into cats from jsonb_array_elements_text(coalesce(p_details->'categories','[]'));
 select coalesce(array_agg(btrim(value)),'{}') into labels from jsonb_array_elements_text(coalesce(p_details->'tags','[]'));
 if cardinality(cats)>20 or cardinality(labels)>20 or exists(select 1 from unnest(cats||labels) t where char_length(t) not between 1 and 60) then raise exception 'Use up to 20 categories and tags, each under 60 characters'; end if;
 photo:=coalesce(p_details->>'photo_path','');
 if photo<>'' and (photo not like p_profile_id::text||'/photos/%' or not exists(select 1 from storage.objects where bucket_id='creator-photos' and name=photo)) then raise exception 'Upload a photo for this creator first'; end if;
 insert into public.training_program_creators(id,display_name,headline,bio,experience,years_experience,role,categories,tags,qualifications,website,photo_path,published)
 values(p_profile_id,btrim(p_details->>'display_name'),btrim(coalesce(p_details->>'headline','')),btrim(coalesce(p_details->>'bio','')),btrim(coalesce(p_details->>'experience','')),nullif(p_details->>'years_experience','')::integer,coalesce(p_details->>'role','community'),cats,labels,coalesce(p_details->'qualifications','[]'),btrim(coalesce(p_details->>'website','')),photo,coalesce((p_details->>'published')::boolean,false))
 on conflict(id) do update set display_name=excluded.display_name,headline=excluded.headline,bio=excluded.bio,experience=excluded.experience,years_experience=excluded.years_experience,role=excluded.role,categories=excluded.categories,tags=excluded.tags,qualifications=excluded.qualifications,website=excluded.website,photo_path=excluded.photo_path,published=excluded.published,updated_at=now()
 returning * into row;
 if previous.id is not null and (previous.display_name,previous.role,previous.qualifications) is distinct from (row.display_name,row.role,row.qualifications) then
  update public.training_program_creators set credential_revision=credential_revision+1,verified_revision=null,verified_at=null,verified_summary='' where id=p_profile_id returning * into row;
  update private.creator_verification_requests set status='superseded',reviewed_at=now() where creator_id=p_profile_id and status in ('pending','approved');
 end if;
 return row;
end $$;
revoke all on function public.creator_save_profile(uuid,jsonb) from public,anon;
grant execute on function public.creator_save_profile(uuid,jsonb) to authenticated;

create function public.creator_submit_verification(p_creator_id uuid,p_statement text,p_evidence_paths text[] default '{}') returns uuid
language plpgsql security definer set search_path='' as $$
declare row public.training_program_creators; result uuid; path text;
begin
 if not private.training_program_target_visible(p_creator_id,null) then raise exception 'Creator access required'; end if;
 select * into row from public.training_program_creators where id=p_creator_id for update;
 if row.id is null then raise exception 'Save your creator profile first'; end if;
 if char_length(btrim(coalesce(p_statement,''))) not between 10 and 3000 or coalesce(cardinality(p_evidence_paths),0)>10 then raise exception 'Explain your credentials and provide up to 10 evidence files'; end if;
 if row.verified_revision=row.credential_revision then raise exception 'These credentials are already verified'; end if;
 for path in select unnest(p_evidence_paths) loop
  if path is null or path not like p_creator_id::text||'/evidence/%' or not exists(select 1 from storage.objects where bucket_id='creator-evidence' and name=path) then raise exception 'Evidence must belong to this creator'; end if;
 end loop;
 insert into private.creator_verification_requests(creator_id,credential_revision,snapshot,evidence_paths,statement)
 values(p_creator_id,row.credential_revision,jsonb_build_object('display_name',row.display_name,'role',row.role,'qualifications',row.qualifications),coalesce(p_evidence_paths,'{}'),btrim(p_statement)) returning id into result;
 return result;
end $$;
revoke all on function public.creator_submit_verification(uuid,text,text[]) from public,anon;
grant execute on function public.creator_submit_verification(uuid,text,text[]) to authenticated;

create function public.creator_verification_requests(p_creator_id uuid default null) returns setof private.creator_verification_requests
language plpgsql stable security definer set search_path='' as $$
begin
 if p_creator_id is null and not private.creator_is_reviewer() then raise exception 'Reviewer access required'; end if;
 if p_creator_id is not null and not private.training_program_target_visible(p_creator_id,null) and not private.creator_is_reviewer() then raise exception 'Creator access required'; end if;
 return query select * from private.creator_verification_requests r where (p_creator_id is null or r.creator_id=p_creator_id) order by r.created_at desc limit 200;
end $$;
revoke all on function public.creator_verification_requests(uuid) from public,anon;
grant execute on function public.creator_verification_requests(uuid) to authenticated;

create function public.creator_review_verification(p_request_id uuid,p_decision text,p_note text) returns boolean
language plpgsql security definer set search_path='' as $$
declare r private.creator_verification_requests; c public.training_program_creators;
begin
 if not private.creator_is_reviewer() then raise exception 'Reviewer access required'; end if;
 if p_decision not in ('approved','changes_requested','rejected','revoked') or p_decision is null or char_length(btrim(coalesce(p_note,''))) not between 10 and 1500 then raise exception 'Choose a decision and explain what was checked'; end if;
 -- Match profile-then-request lock order used by submissions and edits.
 select c2.* into c from public.training_program_creators c2 join private.creator_verification_requests r2 on r2.creator_id=c2.id where r2.id=p_request_id for update of c2;
 select * into r from private.creator_verification_requests where id=p_request_id for update;
 if c.id is null or private.training_program_target_visible(c.id,null) then raise exception 'A reviewer cannot verify their own account'; end if;
 if c.credential_revision<>r.credential_revision or (p_decision='revoked' and r.status<>'approved') or (p_decision<>'revoked' and r.status<>'pending') then raise exception 'Request is no longer current'; end if;
 update private.creator_verification_requests set status=p_decision,reviewer_id=(select auth.uid()),review_note=btrim(p_note),reviewed_at=now() where id=r.id;
 update public.training_program_creators set verified_revision=case when p_decision='approved' then credential_revision else null end,verified_at=case when p_decision='approved' then now() else null end,verified_summary=case when p_decision='approved' then btrim(p_note) else '' end,updated_at=now() where id=c.id;
 return true;
end $$;
revoke all on function public.creator_review_verification(uuid,text,text) from public,anon;
grant execute on function public.creator_review_verification(uuid,text,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('creator-photos','creator-photos',false,3145728,array['image/jpeg','image/png','image/webp']),
 ('creator-evidence','creator-evidence',false,5242880,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
create function private.creator_storage_owner(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id::text=split_part(p_name,'/',1) and private.training_program_owned_family(p.family_id));
$$;
revoke all on function private.creator_storage_owner(text) from public,anon;
grant execute on function private.creator_storage_owner(text) to authenticated;
create policy creator_file_upload on storage.objects for insert to authenticated with check
 (bucket_id in ('creator-photos','creator-evidence') and private.creator_storage_owner(name));
-- Reviewer evidence lookup is encapsulated so storage policies never grant private-table access.
create function private.creator_evidence_visible(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select private.creator_is_reviewer() and exists(select 1 from private.creator_verification_requests r where p_name=any(r.evidence_paths));
$$;
revoke all on function private.creator_evidence_visible(text) from public,anon;
grant execute on function private.creator_evidence_visible(text) to authenticated;
create policy creator_file_read on storage.objects for select to authenticated using
 ((bucket_id in ('creator-photos','creator-evidence') and private.creator_storage_owner(name))
 or (bucket_id='creator-evidence' and private.creator_evidence_visible(name))
 or (bucket_id='creator-photos' and exists(select 1 from public.training_program_creators c where c.published and c.photo_path=name)));

-- Safe creator identity is attached to both the catalogue and programme previews.
drop function public.training_program_list_community();
drop function public.training_program_preview_community(uuid);
create or replace function public.training_program_list_community()
returns table(
  id uuid,
  title text,
  description text,
  purpose text,
  sport text,
  difficulty text,
  age_band text,
  equipment text[],
  tags text[],
  creator_role text,
  credentials_verified boolean,
  creator_id uuid,
  creator_name text,
  creator_headline text,
  creator_categories text[],
  creator_tags text[],
  current_version_no integer,
  current_version_id uuid,
  week_count smallint,
  phase_count smallint,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  return query
  select
    p.id,
    p.title,
    p.description,
    p.purpose,
    p.sport,
    p.difficulty,
    p.age_band,
    p.equipment,
    p.tags,
    coalesce(c.role,p.creator_role),
    coalesce(c.verified_revision=c.credential_revision,false),
    c.id,
    c.display_name,
    c.headline,
    c.categories,
    c.tags,
    p.current_version_no,
    p.current_version_id,
    p.week_count,
    p.phase_count,
    p.updated_at
  from public.training_programs p
  left join public.training_program_creators c on c.id=p.creator_profile_id and c.published
  where p.status = 'active'
    and p.marketplace_status = 'published'
    and p.access_model = 'free'
    and p.current_version_id is not null
  order by p.updated_at desc, p.title asc
  limit 200;
end
$$;

revoke all on function public.training_program_list_community() from public, anon;
grant execute on function public.training_program_list_community() to authenticated;


create or replace function public.training_program_preview_community(p_program_id uuid)
returns table(
  id uuid,
  title text,
  description text,
  purpose text,
  sport text,
  difficulty text,
  age_band text,
  equipment text[],
  tags text[],
  creator_role text,
  credentials_verified boolean,
  creator_id uuid,
  creator_name text,
  creator_headline text,
  creator_categories text[],
  creator_tags text[],
  current_version_no integer,
  current_version_id uuid,
  week_count smallint,
  phase_count smallint,
  content_json jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  return query
  select
    p.id,
    p.title,
    p.description,
    p.purpose,
    p.sport,
    p.difficulty,
    p.age_band,
    p.equipment,
    p.tags,
    coalesce(c.role,p.creator_role),
    coalesce(c.verified_revision=c.credential_revision,false),
    c.id,
    c.display_name,
    c.headline,
    c.categories,
    c.tags,
    p.current_version_no,
    p.current_version_id,
    p.week_count,
    p.phase_count,
    v.content_json
  from public.training_programs p
  left join public.training_program_creators c on c.id=p.creator_profile_id and c.published
  join public.training_program_versions v on v.id = p.current_version_id
  where p.id = p_program_id
    and p.status = 'active'
    and p.marketplace_status = 'published'
    and p.access_model = 'free';
end
$$;

revoke all on function public.training_program_preview_community(uuid) from public, anon;
grant execute on function public.training_program_preview_community(uuid) to authenticated;


