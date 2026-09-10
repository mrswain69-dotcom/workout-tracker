# Phase 4 Analysis — Stage 6 Hardening

## Status

Stage 6 hardening is complete on the Phase 4 Analysis branch. This stage did not redesign the Progress experience or change Analysis truth. It strengthened edge-case handling, language boundaries, information density, responsive behaviour and delivery performance around the Stage 5 Assessment Analysis UI.

## Scope

Stage 6 covered:

- full Phase 1–4 regression coverage
- Analysis causation / prescription-language audit
- invalid benchmark-date hardening
- large-Assessment information-density regression
- narrow-screen / long-label interaction hardening
- bundle-size review and real code splitting
- preservation of the existing Progress data-loading and legacy Stats bridge contracts

No database schema change, backfill or production-data mutation was required.

## 1. Assessment Analysis is now a real lazy-loaded slice

Stage 5 placed Assessment Analysis in Progress correctly, but the production build exposed a Vite warning because the main application JavaScript chunk had reached approximately 514.13 kB minified.

Stage 6 introduced `AssessmentAnalysisSection.jsx` as the lazy boundary. `ProgressDashboard.jsx` now uses `React.lazy` + `Suspense` and no longer eagerly imports:

- `assessmentAnalysisEngine`
- `assessmentAnalysisViewModel`
- `AssessmentAnalysisProgress`

The lazy section receives the already-loaded Progress sources:

- completed Assessment history
- workout logs
- active profile ID
- Session library
- Assessment library
- existing Assess navigation callback

It does not make another database/API request.

A source-level contract requires exactly one lazy declaration and verifies the eager Analysis imports/memos stay absent from `ProgressDashboard.jsx`.

### Bundle result

Before Stage 6:

- main application JS: 514.13 kB minified / 127.33 kB gzip
- Vite emitted the >500 kB chunk warning

After Stage 6:

- main application JS: **478.98 kB minified / 119.47 kB gzip**
- Assessment Analysis JS: **37.53 kB minified / 10.12 kB gzip**
- Assessment Analysis CSS: **7.45 kB minified / 1.90 kB gzip**
- Recharts vendor chunk remains 465.25 kB / 134.45 kB gzip
- the Vite >500 kB warning is **gone**

The warning threshold was not raised or suppressed.

## 2. Impossible calendar dates no longer normalise silently

The original Analysis date guard checked only the `YYYY-MM-DD` string shape. JavaScript can normalise impossible dates such as `2026-02-31` into a valid date in March, which could silently create the wrong displayed benchmark or training interval.

Stage 6 now round-trips YMD values through the UTC date and requires the resulting ISO date to equal the source string. The same calendar-valid rule is applied to:

- between-Assessment evidence interval construction
- observed-consistency interval construction
- Assessment Analysis date presentation

Regression coverage explicitly rejects `2026-02-31` while accepting the valid leap date `2028-02-29`.

## 3. Causation and training-prescription language is locked down

The Phase 4 boundary remains:

> Analysis describes recorded training alongside benchmark change; it does not establish that training caused the result.

Stage 6 adds a dedicated generated-language audit across result, training, focus, overall and Test narratives. It forbids positive causal or prescriptive phrases such as claims that training caused/led to a result or instructions that the athlete must train more/increase load.

The standalone possible-focus narrative has also been strengthened so the caution travels with the value even outside the full UI panel:

> This reflects recorded Session balance only, not a training prescription.

The existing UI wording remains explicit that a Possible Next Focus is based on recorded Session balance and is not an automatic load prescription.

## 4. Information-density hardening

Stage 5 deliberately used collapsed Test evidence rows. Stage 6 now regression-tests a ready Analysis containing **24 Tests** and requires:

- all Test detail rows collapsed initially
- only the Test selected by the user to expand
- no automatic expansion of the remaining Test list

This protects the Progress destination from becoming a very long evidence feed as larger Assessment Templates are created.

## 5. Responsive / interaction hardening

Assessment Analysis now explicitly protects long real-world Test, Session and focus labels with safe word wrapping.

Test disclosure summaries also have a minimum 44 px interaction height, while the existing 980 px / 700 px / 480 px responsive breakpoints and reduced-motion handling remain intact.

## 6. Existing architecture preserved

Stage 6 does not change the Phase 4 truth contracts:

- latest Assessment is compared with the previous compatible Assessment for the same athlete and Assessment Template
- Assessment baseline/PB truth continues to come from released Assessment engines
- training evidence remains strictly between the compared Assessment dates
- only genuine structured Session evidence is classified as Session evidence
- observed consistency remains a recorded training-rhythm measure, not formal plan adherence
- Development Tags remain the generic link between Tests and training evidence
- unlike measurement types remain separate
- Phase 4 does not infer that training caused benchmark change
- the legacy Stats bridge remains present

## 7. Regression gate

Corrected feature-code gate:

- branch head: `a76f49de92adc10a71749b1864b16e857de77f74`
- permanent Workout Tracker CI run #400 (`34477365489`): **success**
- **59/59 test files passed**
- **486/486 tests passed**
- Vite 8.2.2 production build: **success**
- **682 modules transformed**
- npm audit at low threshold: **0 vulnerabilities**
- exact-head Vercel deployment: **success**
- no Vite >500 kB chunk warning after the Analysis split

The temporary Stage 6 guarded patch workflow and script were removed before this Stage 6 document was committed.

## 8. Live production-data safety verification

A read-only verification against the production Supabase project after the Stage 6 feature gate returned:

- workout logs: **499**
- logs containing structured Session blocks: **0**
- Assessment runs: **0**
- Assessment Test results: **0**
- active recurring Assessment schedules: **2**
- active Development Tags: **10**
- Movement / Development-Tag links: **44**
- Test / Development-Tag links: **48**

Protected weekly-plan fingerprints remain unchanged:

- Paul: `a715c519932be388cebe88722439de8b`
- Wilf: `278e036e425e2eeff7b02b417029403f`
- Xander: `b3b95dc0668da96dfcfeccdea21b6cfe`

Stage 6 made no production database/schema writes.

## Stage 6 conclusion

Assessment Analysis is now hardened for release without changing its deterministic truth model. The visible experience remains Stage 5's performance-first Progress integration, while Stage 6 adds stronger date integrity, explicit non-causal/non-prescriptive language contracts, large-Test-set density protection, mobile label/touch handling and a real lazy bundle boundary that removes the previous Vite size warning.

## Next

**Stage 7 — final Phase 4 release gate:** final branch/PR regression, merge to `main`, production deployment and post-deploy verification. The Phase 4 PR must remain draft/unmerged until that release gate is deliberately executed.
