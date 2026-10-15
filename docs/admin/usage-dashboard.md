# Usage dashboard

Settings → App → Admin · Users & activity. Visibility is checked through `wt_admin_usage_access`; report access is independently enforced by the database. Initial owner access is provisioned separately in `private.usage_admins`, keyed to the verified existing account ID. Membership is never derived from user-editable metadata. Other accounts cannot read the private tables or report.

The dashboard separates registered sign-in accounts from non-archived athlete profiles. Admin accounts are excluded by default and can be included explicitly. Deleted accounts are excluded. Account detail is limited to the newest 200 signups; summary totals cover all existing accounts.

Foreground visits are recorded once per account per London calendar date, with a last-seen heartbeat every 15 minutes while the tab is visible. Database writes are throttled to once per 10 minutes. No IP, device, page path or third-party tracking is collected. Visiting while signed out is not tracked. Auth last-sign-in is the only historical fallback before tracking begins; the dashboard explains that these earlier app-use counts are a lower bound. This is not a concurrent-online-user measurement.

Recorded activity uses dated saved log results: strength reps/time/count, cardio distance/time, duration, performed structured Session movements and completed recovery. Empty plan scaffolds, cancelled/suspended blocks, task checkboxes and future workout dates do not qualify. Counts reflect currently saved data, not deleted history. Signup windows, workout-date windows and foreground-day windows all include today and use Europe/London.

Funnel counts are independent current-state stages, not a strict required sequence. No automatic user messaging is performed. The Privacy Notice discloses account-level operational usage reporting.

Backend verification: run `supabase/tests/admin_usage.sql` against a test or connected database. The script rolls back and checks meaningful activity classification, restricted grants, and direct API denial for non-admin claims, including forged user metadata. Live checks additionally exercised the actual admin and an ordinary account, and verified heartbeat deduplication in a rolled-back transaction. Frontend tests cover hidden state for ordinary accounts, loading, filtering, retry and foreground heartbeat cleanup.

The migration filename matches the applied migration version. Admin membership is not seeded by this migration; future installations must explicitly provision their authorised owner.
