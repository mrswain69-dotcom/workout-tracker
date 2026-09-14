alter table public.external_activity_observations
  add column if not exists source_manual_entry boolean not null default false,
  add column if not exists source_device_name text,
  add column if not exists source_external_id text,
  add column if not exists source_upload_id text;

alter table public.external_activity_observations
  drop constraint if exists external_activity_observations_source_device_name_check,
  add constraint external_activity_observations_source_device_name_check
    check (source_device_name is null or char_length(source_device_name) between 1 and 200),
  drop constraint if exists external_activity_observations_source_external_id_check,
  add constraint external_activity_observations_source_external_id_check
    check (source_external_id is null or char_length(source_external_id) between 1 and 500),
  drop constraint if exists external_activity_observations_source_upload_id_check,
  add constraint external_activity_observations_source_upload_id_check
    check (source_upload_id is null or char_length(source_upload_id) between 1 and 200);
