# Phase 3 Progress Dashboard — Stage 2 Assessment Progress Summary Engine

Status: complete on `feature/phase3-progress-dashboard`.

Stage 2 adds the pure Assessment Progress summary layer defined in Stage 0. It introduces no database schema, live Assessment history, UI navigation change, XP rule, badge rule, Session-plan mutation or production seed data.

## Objective

Stage 2 provides one tested source of truth for the Assessment side of the future Progress area:

- latest completed Assessment;
- explicit baseline state;
- genuine new PB events in the latest completed Assessment;
- latest-vs-previous Test classification;
- biggest safely comparable improvements;
- improved, declining, unchanged, mixed and unavailable Test groups;
- retained full Test/run history for later charts;
- profile and optional Assessment-Template scoping.

It composes the existing Phase 2 Assessment history/metric engines instead of duplicating PB or comparison logic.

## Core contracts

`scopeAssessmentProgressHistory(...)` filters supplied runs to the selected profile and optional Assessment Template, then retains only result rows belonging to those runs.

`buildAssessmentProgress(...)` returns completed Assessment count, baseline state, latest Assessment metadata, genuine latest PB events, latest Test statuses, improved/declining/unchanged/mixed/unavailable groups, safe cross-Test improvement ranking, absolute-only improvements, and complete Test/run history for later charts.

### Baseline rules

- 0 completed Assessments → `no_baseline`, no PB or progress claims.
- 1 completed Assessment → `baseline_established`; the first real benchmark sets baseline and produces zero new-PB events.
- 2+ completed Assessments → `comparison_available`; compatible latest-vs-previous comparisons and genuine PB events become meaningful.

### Latest-run truth

Only valid Tests actually present in the newest completed Assessment receive latest-run classification. In-progress/cancelled runs and invalid result rows never affect baseline, PB, improvement or decline summaries. Historical Tests absent from a newer Assessment remain in full history but are not falsely classified in that latest run.

### PB rules

PBs remain derived from immutable compatible history rather than stored permanently. A latest scalar PB contributes one event. Bilateral Tests can contribute independent left and right PB events. Stage 2 exposes both total PB events and number of canonical Tests containing a PB. First results and tied PBs are not new PBs.

### Bilateral status

A bilateral Test can be `mixed`: for example left improves while right declines. Mixed Tests are not forced into either the improved or declining group.

### Biggest-improvement ranking

Only finite percentage improvements that the Phase 2 metric engine says are safe may be ranked across unlike Tests. Signed/zero-crossing metrics such as toe-touch remain visible as genuine absolute improvements but are excluded from cross-unit ranking.

### Metric compatibility

If the frozen Test metric meaning changes incompatibly, historical results stay visible while cross-boundary comparison, decline/improvement and PB mixing are blocked.

## CI-discovered coercion regression

The first Stage 2 gate caught a real bug: `percentageImprovement = null` for signed toe-touch was passed through `Number(null)`, becoming `0` and incorrectly appearing rankable. Stage 2 now rejects null/undefined/blank percentages before numeric conversion, and the regression is permanently tested.

## Verification

Corrected feature code head: `15b862d194ee755addd92ebd8b3a0736614f7b29`.

Permanent corrected gate:

- CI run #258 / ID `34449522331`: success;
- PR merge ref `9c432ea0061718ed90a7ef959a225d09abb19dd1`;
- 31/31 test files passed;
- 339/339 tests passed;
- Stage 2 Assessment Progress tests: 17/17;
- Vite 8.2.2 production build passed;
- npm audit: 0 vulnerabilities;
- Vercel preview: success.

The Stage 2 suite covers profile/template scoping, 0/1/2/3+ history, first-run baseline behavior, higher/lower-is-better comparisons, tied PBs, declines, bilateral PBs, mixed status, safe improvement ranking, signed percentage safety, incompatible metric changes, invalid latest results and Tests absent from the latest run.

## Live production safety

Stage 2 made no SQL writes and no production deployment. Live Supabase remained:

- workout logs: 499;
- structured Session blocks: 0;
- completed structured Sessions: 0;
- Assessment runs/results: 0 / 0;
- active Assessment schedules: 2;
- Programmes / Movements / Session Templates / Session Template Movements: 1 / 15 / 3 / 17.

Protected plan fingerprints remain:

- Paul `a715c519932be388cebe88722439de8b`;
- Wilf `278e036e425e2eeff7b02b417029403f`;
- Xander `b3b95dc0668da96dfcfeccdea21b6cfe`.

Stage 2 does not add UI, Development Trends, fake history, database structures, XP/badges, causal analysis or training recommendations.

Next: Stage 3 — Development Trend engine over shared Development Tags, using normalized per-Test direction/change while protecting incompatible physical units and preserving the Phase 4 analysis boundary.
