# Phase 2 Assessments — Stage 3 DB Access & Library Controller

Status: complete on `feature/phase2-assessments`; no live Supabase data/schema mutation in this stage.

## Objective

Provide the reusable application-layer access required by later Assessment authoring UI without coupling the feature to football or to historical Assessment execution.

Stage 3 builds two layers:

1. `src/assessmentDb.js` — Supabase table access for editable Assessment definitions.
2. `src/components/assessments/assessmentLibraryController.js` — editor-facing normalization, validation, change detection and safe persistence orchestration.

Historical `assessment_runs` and `assessment_test_results` deliberately remain outside the editable library. They are reserved for Stage 5/6.

## Assessment DB access layer

`assessmentDb.js` now exposes:

### Assessment Templates
- `listAssessmentTemplates`
- `createAssessmentTemplate`
- `updateAssessmentTemplate`
- `archiveAssessmentTemplate`

### Canonical Tests
- `listTests`
- `createTest`
- `updateTest`
- `archiveTest`

### Ordered Assessment Template ↔ Test membership
- `listAssessmentTemplateTests`
- `createAssessmentTemplateTest`
- `updateAssessmentTemplateTest`
- `deleteAssessmentTemplateTest`

### Shared Development Tags
- `listAssessmentDevelopmentTags` reads the existing shared `development_tags` table.
- `listTestDevelopmentTags`
- `addTestDevelopmentTag`
- `removeTestDevelopmentTag`

### Whole editable library
- `loadAssessmentLibrary`

`loadAssessmentLibrary` returns only:
- Assessment Templates
- canonical Tests
- ordered Template/Test membership
- shared Development Tags
- Test/Development-Tag links

It does not read Assessment history.

## Editor contracts

The controller converts Stage 1 snake_case database rows into camelCase editor contracts.

Canonical Test metric fields are normalized through the Stage 2 `assessmentMetricEngine`, so Stage 3 cannot silently invent a second interpretation of metric settings.

## Canonical Test reuse

A Test is a reusable canonical definition. An Assessment Template stores ordered membership rows referencing Test IDs rather than embedding duplicate test definitions.

`activeAssessmentsUsingTest()` reports only active Assessment Templates currently using a Test. This supports later safe archive/edit UI.

## Template persistence and versioning

`persistAssessmentDefinition()` mirrors the proven Session pattern:

- validates Assessment name and Test selection
- new Templates always start at version 1
- unchanged definitions perform no writes
- existing retained membership rows are temporarily staged to high positions before reorder
- removed membership rows are deleted
- new membership rows are created
- retained rows are updated to final positions
- a meaningful Assessment definition edit bumps Template version exactly once

This avoids collisions with the Stage 1 unique `(assessment_template_id, position)` constraint.

## Canonical Test persistence and versioning

`persistCanonicalTest()` manages a canonical Test plus its exact Development Tag links.

Behavior:
- new Tests start at version 1
- unchanged Test + unchanged tags performs no writes
- meaningful Test-definition edits bump Test version exactly once
- tag-only changes do not bump the metric-definition version
- duplicate Development Tag IDs are normalized away
- removed links are deleted
- newly selected links are upserted

## Shared Development Tags

Stage 3 does not create a second Assessment tag system.

Tests use the same `development_tags` table already used by Session Movements, connected through `test_development_tags`.

This preserves:

`Movement -> Development Tags <- Test`

without a football-specific Movement/Test foreign key.

## Automated verification

Stage 3 adds:
- `src/components/assessments/assessmentLibraryController.test.js` — 16 tests
- `src/assessmentDb.test.js` — 5 tests

Coverage includes library normalization, snake_case mapping, ordered definition assembly, active usage, exact Development Tag IDs, fingerprints/change detection, metric-rule validation, safe create/reorder/delete/version-bump behavior, canonical Test persistence, exact tag synchronization, DB write-payload mapping and library loading without history.

Final Stage 3 implementation gate:
- 16/16 test files passed
- 192/192 tests passed
- Vite 8.2.2 production build passed
- npm audit found 0 vulnerabilities
- Vercel preview succeeded

## Safety / non-goals

Stage 3 made no Supabase schema/data changes, no Assessment history writes, no profile-plan edits, no historical workout-log edits and no Session Library mutations.

## Next

Stage 4: Assessment Template/Test authoring UI using this DB/controller contract.
