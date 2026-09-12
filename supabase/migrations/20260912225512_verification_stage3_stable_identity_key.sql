-- Verification Integrations — Stage 3 stable derived identity key
-- Derived verified activities are keyed by the exact sorted set of source observations.

alter table public.verified_activities
  add column identity_key text;

alter table public.verified_activities
  add constraint verified_activities_identity_key_check
    check (identity_key is null or identity_key ~ '^verification_match_v1:[0-9a-f]{64}$');

create unique index verified_activities_identity_key_idx
  on public.verified_activities(identity_key)
  where identity_key is not null;
