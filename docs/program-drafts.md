# Undated programme drafts

New blank Program in Plan → Build or Program Library → My Programs opens a separate draft. It does not replace the active plan. Build uses the existing phases, weeks, blocks, movements and Assessment checkpoint controls. The start-date field is hidden while drafting; stored draft content has an empty start date and no profile metadata or legacy calendar flag.

Save to My Programs creates a private, reusable library programme. Drafts opened through View details → Edit as draft save edited content as a new immutable version. Existing active copies and issued assignments continue using their current content. An already superseded or archived source is rejected before saving; Save as separate programme is available to retain those edits independently. Catalogue metadata is reloaded before version saves. This preflight uses the existing save RPC and is not an atomic concurrent-edit lock; simultaneous saves can both append versions, with both retained in history.

An unfinished draft is retained in this browser per account family and selected profile. Refresh and profile switching return to the active builder; Resume draft explicitly reopens the matching draft. Back to active plan retains the draft. Discard draft removes only this browser's working copy. Replacing unfinished work asks before discarding it. Save to My Programs is required for cross-device access. Browser storage failures produce visible feedback while retaining the in-memory edits.

Opening, resuming and saving use existing family PIN authorisation. Local draft edits never call profile-plan persistence. In-flight library saves retain their original family/profile; late results do not change the selected profile's editor. Failure retains the draft for retry; duplicate submissions and draft edits are blocked for the profile being saved.

Apply programme remains in the saved programme's details. Select Starts Monday and the completion mode, then choose how it fits with the active plan and confirm. Application stamps the selected date on the active copy, keeping the library version undated. Logs and rewards remain under the existing application contract.

No migration, new table or new RPC is required. The existing owner-checked training_program_save and training_program_apply_accessible APIs are reused. The rollback-only supabase/tests/training_program_drafts.sql check verifies authenticated save/edit without active-plan changes, immutable original versions, cross-family save denial, chosen-date application, reward retention and an undated saved copy after application. It passed against the connected database with all temporary writes rolled back.

Validation includes real App DOM tests for building, saving and resuming drafts, library controls/application tests, persistence and async profile-isolation tests, the existing programme suites and a production build. Physical mobile/desktop browser verification remains outstanding.
