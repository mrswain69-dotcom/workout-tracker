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
