-- Verified unmatched activity blocks
-- Existing compatible Log blocks may still be populated conservatively. This preference
-- controls only whether an otherwise-unmatched, live-recorded activity creates a new block.

alter table public.external_connection_preferences
  add column if not exists unmatched_activity_action text not null default 'ask';

alter table public.external_connection_preferences
  drop constraint if exists external_connection_preferences_unmatched_activity_action_check;
alter table public.external_connection_preferences
  add constraint external_connection_preferences_unmatched_activity_action_check
  check (unmatched_activity_action in ('ask', 'automatic', 'never'));

alter table public.external_activity_population_controls
  drop constraint if exists external_activity_population_controls_suppress_reason_check;
alter table public.external_activity_population_controls
  add constraint external_activity_population_controls_suppress_reason_check
  check (suppress_reason in ('user_undo', 'user_declined'));

comment on column public.external_connection_preferences.unmatched_activity_action is
  'Controls unmatched eligible live-recorded activity handling: ask, automatic block creation, or never create a new Log block.';
comment on column public.external_activity_population_controls.suppress_reason is
  'Server-only reason an eligible external activity must not be re-created in the Workout Tracker Log.';
