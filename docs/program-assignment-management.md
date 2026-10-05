# Programme assignment management

Implemented October 5, 2026.

- Pending invitations can be rescheduled, including start date, ending behaviour and coach note. Starts align to Monday.
- Rescheduling an accepted programme sends a new offer of its existing frozen version. Replace / update offers the latest saved version of the selected owned programme.
- The existing programme stays attached until the athlete accepts. Declining or revoking an offer preserves it. Only one replacement offer may be pending per original assignment.
- An update occupies the original main/add-on slot. Add-on updates preserve the main plan and respect the one-add-on limit; main updates preserve any independent add-on. Undo restores the exact original plan.
- Assignment state distinguishes invitations and responses from scheduled, active, finished, holding, inactive, undone and removed programmes. It derives attachment from the current recipient plan rather than assuming acceptance means active.
- Coaches can refresh and filter status. Active status is unavailable once the team relationship is removed; no private plans or logs are returned.

The migration adds scoped RPCs and a replacement relationship. Existing acceptance logic is private behind a recipient-authorised wrapper. No historical logs, XP rules or rewards are changed.

The rollback-only SQL test exercises coach and athlete identities, unauthorised management, version offers, decline, exact undo, add-on replacement, status boundaries and log preservation. It uses temporary fixture records in existing account families and leaves no changes behind.

Recipient permissions, in-app notifications, linked assessment checkpoints and opt-in coach reporting are now implemented; see program-coaching-workflow.md. Direct clients without team membership and bulk version offers remain outside this phase.
