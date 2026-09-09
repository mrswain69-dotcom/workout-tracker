-- Tighten Phase 2 Assessment Data API privileges to the intended surface.
-- RLS remains the row-level authorization layer; these grants remove unnecessary
-- table-level privileges inherited from Supabase public-schema defaults.

revoke all on public.assessment_templates from authenticated;
revoke all on public.tests from authenticated;
revoke all on public.assessment_template_tests from authenticated;
revoke all on public.test_development_tags from authenticated;
revoke all on public.assessment_runs from authenticated;
revoke all on public.assessment_test_results from authenticated;

grant select, insert, update on public.assessment_templates to authenticated;
grant select, insert, update on public.tests to authenticated;
grant select, insert, update, delete on public.assessment_template_tests to authenticated;
grant select, insert, delete on public.test_development_tags to authenticated;
grant select, insert, update on public.assessment_runs to authenticated;
grant select, insert, update on public.assessment_test_results to authenticated;
