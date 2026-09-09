# Phase 2 Assessments — Stage 4 Authoring UI

Status: complete on `feature/phase2-assessments`; definition UI only. No live Assessment seed/history data, plan changes, workout-log changes or schema changes were made in this stage.

## Objective

Expose the Stage 1–3 Assessment definition system as a parent-facing authoring experience while preserving the existing parent PIN/unlock controls.

## Components

### `AssessmentTestEditor.jsx`
Parent editor for reusable canonical Tests:
- name and description
- metric type and unit
- higher/lower-is-better direction
- attempt count
- single/best/average retained-result strategy
- one result or separate left/right dimensions
- negative-value permission
- PB eligibility
- shared Development Tag assignment
- decimal precision and percentage-improvement safety controls
- attempts/successes comparison by successes or success rate

The editor uses the Stage 2 metric engine as the source of truth and prevents the unsupported attempts/successes + average combination.

### `AssessmentTemplateEditor.jsx`
Parent editor for Assessment Templates:
- name, category and description
- ordered canonical Test membership
- add/remove/reorder Test rows
- per-template section label
- optional display-label override
- instructions and protocol text

Validation is delegated to the Stage 3 Assessment Library controller.

### `AssessmentTemplateLibrary.jsx`
Parent-facing Assessment Library:
- Assessments / Tests tabs
- create/edit/archive canonical Tests
- create/edit/archive Assessment Templates
- Development Tag summaries
- active-Assessment Test usage summaries
- blocks archiving a Test while an active Assessment still uses it
- refresh/error/success states
- definition-only reads; no Assessment run/history access

## Parent lock integration

The Assessment Library is mounted as a full-width section of the existing Settings screen in `App.jsx`.

All definition mutations pass through an `authorizeMutation` callback. `App.jsx` connects that callback to the existing `ensureUnlocked(reason)` parent PIN mechanism. A dedicated regression test proves that denied authorization causes zero Assessment DB writes.

## Verification

Stage 4 added 30 UI/authorization tests:
- 8 Assessment Test editor tests
- 9 Assessment Template editor tests
- 11 Assessment Library tests
- 2 parent-authorization tests

Final implementation gate before this documentation commit:
- 20/20 test files passed
- 222/222 tests passed
- Vite 8.2.2 production build passed
- npm audit: 0 vulnerabilities
- Vercel preview: success

The first Stage 4 UI run correctly failed because the new React tests were missing the explicit jsdom environment marker. No application defect was involved; the test environment was corrected and the full gate then passed.

## Safety

Stage 4 does not:
- seed the Football Monthly Benchmark
- create Assessment runs/results
- modify Supabase schema or RLS
- modify profile plans
- modify historical workout logs
- modify the Session Library

Those boundaries remain reserved for later Phase 2 stages.
