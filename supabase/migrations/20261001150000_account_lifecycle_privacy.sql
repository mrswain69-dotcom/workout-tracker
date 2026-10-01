-- Workout Tracker account lifecycle / privacy support
-- Additive only. Account deletion itself is authenticated server-side and relies
-- on the existing family-owned ON DELETE CASCADE graph.

alter table public.families
  add column if not exists welcome_email_sent_at timestamptz;

comment on column public.families.welcome_email_sent_at is
  'Timestamp of the one-time Workout Tracker welcome/tutorial email. Deleted with the family account.';

-- No browser grant is added for account deletion. The existing owner update path
-- may read this column with the family row; the lifecycle Edge Function is the
-- authority that sets it after a successful transactional email.
