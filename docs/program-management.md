# Personal programme management

Plans → Program Library → My Programs → View details opens a focused popup with Details, Version history and Sharing links. Cards have a single entry action. The popup closes with Close, Escape or a backdrop click, keeps keyboard focus inside while open and returns focus to the opener.

Details starts with the current frozen version and a week preview. All seven days remain in one horizontal scroll row on desktop and mobile. Use, duplicate, sharing, assignment and archive/restore actions live here; metadata editing and saving the active plan as a new version are expandable. Each action has an explanation in the expandable help section. Duplicate/restore forms scroll into view and receive focus. The sharing creator is grouped separately from existing links, and each existing link has its own expandable expiry editor.

Details edits name, description, purpose, sport, difficulty, age band, equipment and tags. Metadata edits do not create or rewrite immutable versions and do not change active plans. An updated-at check rejects stale saves from another tab.

Version history loads on demand, shows dates and change notes, and previews the weeks of the actual saved content. Duplicate creates a separate owned programme from the selected version. Restore appends its content as a new latest version; it does not apply it to a profile or replace issued assignments. Restore checks the current version ID to prevent overwriting a concurrently saved version. Assessment definitions from owned frozen versions are retained even if their original library entries have been edited or archived. Supplied definitions must exactly match an owned saved snapshot; arbitrary client snapshots are not trusted.

Archived Programs is collapsed by default. Restore programme returns it to My Programs without changing its versions, recipients, active plans, logs or XP. Archived versions can still be previewed or duplicated. Restore-as-new-version requires restoring the programme first.

Sharing links can be created for preview-only or use-and-adapt access, copied, revoked or given an expiry between 1 and 365 days from today. Each link remains attached to the version originally shared. Expired links may be renewed; revoked links cannot be revived. Archived programmes pause unrevoked links until the programme is restored. Revocation and expiry prevent future adoption, but do not remove copies/plans already adopted. Existing follow links remain manageable; creating enforced follow-as-supplied programmes remains an assignment workflow.

Save new version accepts an optional change note. Use displays a replacement confirmation covering base training and task replacement, retained independent add-ons and recorded history. Owned-programme replacement has no automatic undo: save the current plan first to return to it later. Existing assigned-programme undo is unchanged.

Management RPCs require owner-family access, have fixed empty search paths and are not executable by anonymous callers. Table access stays SELECT-only under existing RLS. The deliberate authenticated SECURITY DEFINER advisor notices reflect the owner-checked mutation APIs, rather than direct write grants.

Verification: UI tests cover metadata, frozen-version preview, duplication/restoration, error feedback, authorization, expiry/revocation, collapsed archives and replacement cancellation. Rollback-only two-account SQL tests cover snapshots after Assessment archival, stale writes, owner/recipient isolation, link-token RLS, revoked-link access, anonymous execute denial, issued-version preservation and unchanged active plans. Existing coaching and assignment SQL suites also pass. Local browser automation failed at daemon startup, including a debug retry, so authenticated visual and physical narrow-device testing remains outstanding.

Direct clients outside teams are now covered by [coaching connections](program-direct-clients.md).

Next wider roadmap: email notifications, public Discover, commercial entitlements, richer reporting/export and device/accessibility verification.
