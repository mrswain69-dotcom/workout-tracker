-- Verification Integrations — Stage 3 manual-link uniqueness hardening
-- Additive constraint only. No workout logs, XP, provider observations or historical records are rewritten.

-- One physical manual target may verify at most one verified activity.
-- Block-backed logs use the exact block identity; legacy/date-level cardio uses the log identity.
create unique index if not exists external_activity_links_unique_manual_block
  on public.external_activity_links(profile_id, manual_log_id, manual_block_id)
  where manual_block_id is not null;

create unique index if not exists external_activity_links_unique_manual_log
  on public.external_activity_links(profile_id, manual_log_id)
  where manual_block_id is null;
