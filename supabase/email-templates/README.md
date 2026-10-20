# Workout Tracker Auth Email Production Configuration

## Redirect configuration
Hosted Supabase Auth must use a production Site URL rather than localhost.

Immediate production URL:
- https://workout-tracker-ivory-tau.vercel.app

Also keep the branded Workout Tracker domain ready for cutover:
- https://app.workouttrackerapp.io

In Supabase Authentication → URL Configuration:
- Site URL: https://workout-tracker-ivory-tau.vercel.app
- Additional Redirect URLs:
  - https://workout-tracker-ivory-tau.vercel.app/**
  - https://app.workouttrackerapp.io/**
  - localhost patterns only for development, never as Site URL

The frontend also passes the browser's current origin as emailRedirectTo for signup and resend, so production confirmation links return to the exact Workout Tracker origin used by the account creator.

## Sender identity
Recommended transactional sender:
- Sender name: Workout Tracker
- From address: support@workouttrackerapp.io

Use custom SMTP rather than Supabase's built-in development SMTP for production.

## Auth template subjects
- Confirmation: Confirm your Workout Tracker account
- Recovery: Reset your Workout Tracker password
- Email change: Confirm your new Workout Tracker email
- Invite: You’ve been invited to Workout Tracker

Template files in this folder are the source-controlled production copies. Hosted Supabase templates must be pasted into Authentication → Email Templates.

### Readability update October 2026
Confirmation, recovery, invitation and email-change templates now inline their
text/background styles, provide a table-backed cyan action with dark text, and
include a copyable fallback confirmation URL. Confirmation also explains returning
to the original phone after confirming on another device.

Publishing the web app does not publish these hosted Auth templates. Apply the four
HTML files through the Supabase Email Templates dashboard or Management API, then
test actual delivery in light and dark email clients. Local checks confirm the
action colours survive removal of the stylesheet block; they do not simulate every
email client's forced dark mode.

## Content policy
Auth mail should remain transactional:
- one primary action
- no marketing copy
- clear security fallback
- support address in the footer
- no tracking links

## DNS / delivery
Transactional email domain: workouttrackerapp.io
Provider: Resend
Tracking: disabled
TLS: enforced


## Account lifecycle emails
Two additional transactional emails are source-controlled here:
- `welcome.html` — one-time welcome/tutorial after the verified account first initialises.
- `account_deleted.html` — courtesy confirmation after permanent account deletion.

These are sent by the authenticated `account-lifecycle` Edge Function rather than Supabase Auth. Production needs:
- `RESEND_API_KEY` available to the Edge Function runtime.
- optional `APP_PUBLIC_URL` when the canonical public URL moves away from the immediate Vercel URL.

The Edge Function records `families.welcome_email_sent_at` only after a successful welcome delivery, so refreshes cannot create a repeated welcome sequence.
Account deletion never depends on the courtesy deletion email succeeding.
