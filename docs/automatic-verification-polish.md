# Automatic Verification Polish

This phase makes verified external activity behave as background evidence rather than a manual import workflow.

## Strava automatic sync

Workout Tracker maintains the single application-level Strava webhook subscription from authenticated server paths. Existing connected athletes silently ask the server to ensure the subscription when Progress loads; new OAuth connections and manual source checks provide backup provisioning paths. Signed webhook create/update/delete events refresh the external observation and run reconciliation automatically. Progress reloads local evidence after the app returns to the foreground so webhook-arrived activity appears without requiring Run sync.

`Run sync` remains a recovery/fallback control. It also repairs the webhook subscription when possible.

A future/user-disabled `external_connections.auto_sync_enabled = false` is respected by the UI, authenticated provisioning action, manual-sync provisioning step and webhook processor.

## Strength session automatic matching

Automatic strength matching is deliberately session-level. Garmin/Strava evidence can prove that a Strength session happened, but it does not claim to verify individual exercise names, sets, reps or weights.

Before scoring, overlapping performed Workout Tracker strength blocks from the same log are clustered into one physical session candidate. This removes false ambiguity caused by a planned strength block plus extra movements recorded during the same workout.

A candidate can auto-link only when it clears the existing confidence threshold and remains at least the existing confidence margin ahead of the next candidate. Strong timing is required. Separate sessions remain separate: overlapping timestamps alone cannot cluster blocks whose starts are more than 90 minutes apart. Weak or competing evidence remains unlinked for athlete confirmation.

Manual athlete-confirmed links are preserved against the original raw block candidate so existing corrections remain authoritative.

## Authority boundary

No reward rule changes in this phase. Provider evidence remains evidence-only. It never rewrites Workout Tracker movement results or becomes an independent XP source.
