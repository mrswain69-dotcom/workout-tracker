# Programme coaching workflow

Implemented October 2026 on top of assignment management.

## Recipient permissions

The assignment composer offers edit and save a personal copy, edit active copy only, or follow as supplied. Pending permissions can be changed in Assignments sent. Replacement offers inherit the original permissions; a pending offer can be adjusted before acceptance. Acceptance shows the permissions alongside the adoption choices.

Protected main programmes are read-only in Build. A profile update trigger also prevents direct authenticated REST edits while the assignment remains attached. Protected add-on content is guarded separately, allowing the personal base to remain editable. Leaving, removing an add-on, switching programmes and exact undo remain available. Leaving a team ends coach reporting access but retains the recipient’s already granted programme controls.

Permitted add-ons can be selected with Edit add-on in Build without changing the personal base. Save personal copy is available when copying is allowed. Library saving is disabled for a no-copy main assignment, and unchanged no-copy issued content cannot be saved as a new owned version through the database. These are product permissions, not DRM against manually recreating visible workouts.

## In-app notifications

The header inbox covers new invitations, update offers, schedule/permission changes, acceptance, decline, revocation, undo and add-on removal. Events are recorded transactionally with assignment changes. Recipient notifications belong to the target profile; coach responses belong to the assigning family. The inbox checks on focus, visibility return and once per minute while visible, with at most 50 recent entries. Opening a notification marks it read and opens the appropriate Library section. Failed reads have visible feedback.

Email delivery is not included. No external messages are sent by this migration.

## Assessments

The Build checkpoint selector links a real Assessment from the Assessment Library. A newly saved programme version freezes the template and ordered Test definitions. Acceptance imports a recipient-owned Assessment once per definition and schedules before/after checkpoints on the first/final day of each phase.

Checkpoint cards in Assessments show upcoming, due (seven-day window), overdue, in progress or completed. Starting a checkpoint stores its identity on the Assessment run. Completing it therefore links results back to the programme, rather than matching any unrelated run with the same template. Starting uses the checkpoint's frozen definition, even if either party subsequently edits their Assessment Library.

Repeated programmes get fresh checkpoint identities per cycle when Assessments refreshes. Previous runs remain linked to previous cycles. Rescheduling updates due dates; leaving, replacing or undoing deactivates/reactivates the relevant schedules without deleting historical runs. Existing named placeholders remain readable and must be replaced with a real linked Assessment. Existing immutable issued versions are not rewritten.

## Coach reporting and privacy

Recipients separately opt in to adherence and checkpoint-result sharing at acceptance, and can change either setting in Shared & assigned. Both default off, including update offers. Coach reports compare up to 50 accepted assignments, filtered by programme, team and period (four/eight weeks or 90 days).

Reports contain aggregate programme block counts, per-day counts and linked valid Assessment scores. They exclude private notes, raw sets, unrelated blocks and full plans/logs. Reporting access requires the current coach/team relationship and stops immediately on the next query when consent is withdrawn or membership removed.

Adherence covers the current attached programme from acceptance, excluding future days and excused blocks. Strength distinguishes fully entered planned sets from partial activity; Sessions require explicit completion; recovery uses respected recovery; duration/cardio use recorded minutes. These are saved-log completion measures, not device verification or a clinical outcome claim. Before/after deltas require matching test name, position, metric definition and protocol, with separate side scores supported.

## Verification

- JavaScript component/controller/engine regressions, including cross-profile inbox races, failure feedback, explicit sharing, checkpoint identity and add-on preservation.
- Rollback-only database tests with two account identities, authenticated direct profile writes, permissions, transactional events, frozen definitions, repeated cycles, opt-in isolation and membership removal.
- Previous assignment lifecycle/add-on/undo SQL tests run with the new migration.
- Production build and whitespace checks.

The local agent-browser daemon failed to start; no manual authenticated browser-flow or mobile visual check is claimed.

Remaining wider roadmap: direct clients outside teams, email notifications, commercial entitlements, public Discover, richer reporting/export and broader device/accessibility verification.
