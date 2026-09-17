# Strava webhook live activation fix

Production audit after the automatic-verification release showed manual Strava sync working while automatic webhook provisioning returned `state: unavailable` with `reason: missing_configuration`.

The cause was an over-strict provisioning guard that required both an explicitly configured webhook verification token and a webhook signing secret. Strava subscription creation itself does not require a signing secret, and a verification token can be generated server-side.

This fix:

- derives a deterministic verification token from the server-held Strava client secret when no override is configured;
- keeps an explicit verification-token override supported;
- makes webhook signature verification conditional on a signing secret actually being configured;
- when no signing secret is configured, validates the incoming subscription id against the live application-level Strava subscription before provider data can be changed;
- preserves the existing application-level subscription self-healing and legacy configured subscription-id support;
- stabilizes an unrelated Groups test fixture whose hard-coded invite expiry elapsed on 2026-09-17.

No reward, XP, provider-data ownership, or matching-authority rules change in this fix.
