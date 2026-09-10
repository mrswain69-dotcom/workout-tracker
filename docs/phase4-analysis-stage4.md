# Phase 4 Analysis — Stage 4 Combined Engine & View-Model

Status: complete.

Stage 4 combines the already-tested Phase 4 evidence, consistency and Session-focus primitives into one deterministic Assessment Analysis model, then maps that model into a UI-ready presentation contract. React is not responsible for recalculating benchmark truth, Session relevance, PBs, consistency or focus selection.

## Inputs

The combined engine consumes only existing trusted sources:

- completed Assessment runs/results and immutable Assessment snapshots;
- structured Session snapshots from workout logs;
- Session Library definitions/relationships;
- Assessment Library definitions/relationships;
- shared Development Tags.

No Phase 4 summary/cache table is introduced and no production history is rewritten.

## Combined Analysis engine

File: `src/engine/assessmentAnalysisEngine.js`

Public outputs now include:

- Analysis state: `no_baseline`, `baseline_only`, `analysis_ready`;
- previous/latest same-template Assessment context;
- strict between-Assessment interval;
- existing Assessment Progress truth and genuine latest PB count;
- improved / declined / unchanged / mixed / unavailable Test counts;
- total between-Assessment structured training;
- observed structured-training consistency;
- relevant Session balance and cautious possible next focus;
- per-Test Assessment change + related training evidence;
- evidence-level counts (`high`, `medium`, `low`, `none`);
- current-taxonomy fallback flag;
- deterministic result/training/focus narratives;
- explicit causation boundary.

## Test-level narrative contract

Each Test Analysis preserves:

- latest / previous / baseline result context;
- comparison status from the released Assessment Progress engine;
- genuine PB context;
- percentage improvement only where the existing engine considers it safe;
- frozen/fallback Development Tag provenance;
- related Session evidence;
- explicit recorded executions separately from attempts/successes;
- evidence-detail level;
- evidence limitation/taxonomy notes;
- cautious descriptive narrative.

The engine does not claim that recorded training caused an Assessment result.

## Overall narrative contract

The overall Analysis presents result and training facts as separate observations before any Session-balance focus is shown.

It may state, for example, that:

- one Test improved and one new PB was recorded;
- three completed structured Sessions were recorded in the interval;
- structured training was observed in three of five seven-day periods;
- Session B was completed less often than another related active Session.

It must not say that Session B, repetition volume, training frequency or any other observed factor caused the Test outcome.

The exported causation boundary is:

`Analysis describes recorded training alongside benchmark change; it does not establish that training caused the result.`

Observed consistency is also explicitly labelled as training rhythm and not formal plan adherence.

## Analysis view-model

File: `src/engine/assessmentAnalysisViewModel.js`

The view-model provides Stage 5 with presentation-ready data:

- deterministic UK benchmark date labels;
- deliberate 0 / 1 / 2+ Assessment states;
- Assessment summary cards;
- between-Assessment training cards;
- observed consistency label/note;
- evidence-quality counts;
- taxonomy-fallback indicator;
- Session-balance rows;
- possible-next-focus presentation data;
- per-Test status/evidence labels and semantic tones;
- previous/latest/baseline display values;
- typed Test training facts;
- result/training/focus narratives;
- causation and consistency boundary notes.

The view-model does not recompute Assessment comparison or PB truth.

## Deliberate empty/baseline states

### 0 completed Assessments

- no comparison cards;
- no training-analysis cards;
- no possible focus;
- prompt to establish the first Assessment baseline.

### 1 completed Assessment of the latest template

- baseline is acknowledged;
- no fake latest-v-previous comparison;
- no between-benchmark analysis;
- prompt to complete the same Assessment Template again.

### 2+ completed Assessments of the same template

- Analysis is available;
- previous/latest benchmark dates are shown;
- Test change, training context, consistency and Session balance can be presented together.

## Stage 4 regression coverage

New Stage 4 tests cover:

- no-baseline and baseline-only states;
- same-template Analysis-ready integration;
- genuine PB and improvement summary propagation;
- Test-level related training evidence;
- between-Assessment Session totals;
- seven-day observed-consistency propagation;
- relevant Session imbalance and deterministic focus;
- balanced Sessions returning no artificial focus;
- athlete/profile isolation;
- typed executions versus attempts/successes;
- evidence-detail presentation labels;
- taxonomy fallback visibility;
- UK date formatting;
- causation and plan-adherence boundary wording.

Verified Stage 4 code head before closure documentation: `93d7d453ebd71629f059aa3e3fb7ebb95aff886e`.

Permanent CI on that code head:

- 53 / 53 test files passed;
- 469 / 469 tests passed;
- Vite 8.2.2 production build passed;
- 673 modules transformed;
- npm audit at `--audit-level=low`: 0 vulnerabilities;
- exact-head Vercel status: success.

## Live production-data verification

Stage 4 closure used read-only Supabase queries only.

Verified unchanged:

- workout logs: 499;
- structured Session logs: 0;
- Assessment runs: 0;
- Assessment Test results: 0;
- active recurring Assessment schedules: 2;
- active Development Tags: 10;
- Movement / Development-Tag links: 44;
- Test / Development-Tag links: 48;
- Paul plan fingerprint: `a715c519932be388cebe88722439de8b`;
- Wilf plan fingerprint: `278e036e425e2eeff7b02b417029403f`;
- Xander plan fingerprint: `b3b95dc0668da96dfcfeccdea21b6cfe`.

No production data or schema writes were made.

## Temporary patch cleanup

The temporary guarded Phase 4 patch workflow/script used during Stage 1/2 correction were removed before Stage 4 closure:

- `.github/workflows/phase4-apply.yml`;
- `scripts/phase4-apply.py`.

They are not part of the intended Phase 4 product change.

## Stage 4 acceptance

Stage 4 is accepted when the clean documented branch head also passes the permanent CI/build/audit and receives an exact-head successful Vercel status.

Next: **Stage 5 — integrate Assessment Analysis into the existing Progress destination with dark-first responsive presentation and deliberate 0/1/2+ states.**
