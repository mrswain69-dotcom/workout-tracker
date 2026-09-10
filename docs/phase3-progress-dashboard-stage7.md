# Phase 3 / Stage 7 — Progress range, responsive and parity refinement

## Status

Complete.

## Scope

Stage 7 is the final Progress product-refinement stage before the Phase 3 release gate. It adds a coherent training-detail range control, reduces information density, applies the Workout Tracker dark-first brand system consistently to Progress, tightens responsive behaviour, and makes an explicit legacy Stats parity decision.

Stage 7 does **not** change Session, Assessment or Development truth rules. It does not rewrite history, change weekly plans, create database summary models, infer training causality, or add Phase 4 recommendations.

## Training detail range contract

The structured-training detail layer now has one shared range control:

- **Last 4 weeks** — default; rolling 28 days ending on the selected/reference date.
- **This month** — calendar-month structured totals/distribution/movements. The chart and visible date horizon stop at the selected/reference date so future days in the month are never rendered as zero-performance periods.
- **All time** — all genuine structured Session history.

The selected range drives the same analytical layer throughout Progress:

- selected-range completed and partial Session totals;
- active Session days;
- structured training time;
- explicit compatible recorded executions;
- attempts/successes accuracy where available;
- Completed Sessions chart;
- Training Time chart;
- Session Distribution;
- Movement Totals.

The four immediate orientation cards remain independent of that analytical filter:

- Sessions this week;
- Sessions this month;
- Current streak;
- XP.

This avoids changing familiar orientation values when the athlete switches a deeper analytical range.

Switching profiles resets the training-detail range to **Last 4 weeks** rather than carrying another athlete's display preference into the newly selected profile.

## Chart behaviour

Last-4-weeks and This-month charts use consecutive 7-day buckets from the existing Stage 1 aggregation rules. The This-month chart terminates at the selected/reference date even though the underlying calendar-month summary window remains the full month contract.

All-time charts use one bucket per month **only when that month contains genuine structured Session activity**. Months that contain only legacy workouts are not drawn as synthetic zero structured-training months. All-time labels are human-readable (for example `Sept 2026`).

Legacy workouts are never reclassified as Sessions or Movements by any range.

## Information-density review

Stage 5 exposed nine training cards at once. Stage 7 separates those into:

1. four stable orientation cards; and
2. five contextual selected-range cards beneath a compact range toolbar.

Session Distribution and Movement Totals show a small selected-range chip so their scope is visible without repeating another full filter control.

Assessment and Development do not receive the training time-range selector in Stage 7. Their Phase 3 semantics are based on completed benchmark history, latest-vs-previous comparison, current compatible metric cohorts and the Stage 3 recent-trend rules. Adding an arbitrary time-window filter there would create a second, conflicting definition of Assessment/Development truth rather than merely changing presentation.

## Brand and experience refinement

Progress is now dark-first and follows the Brand & Experience System:

- background: `#0F1117`;
- muted border/surface role: `#2A2D36`;
- interaction cyan: `#00E5FF`;
- progress green: `#00FF88`;
- prestige/PB gold: `#FFD700`;
- caution red: `#FF4D4D`.

Cyan is used for interaction/selection and structural emphasis. Green is used for positive progress. Gold is reserved for PB/prestige treatment. Red is reserved for caution/decline/overdue states.

The visual layer reduces card padding and chart height modestly, keeps the data-first performance feel, darkens chart grids/tooltips, and avoids decorative animation. A `prefers-reduced-motion` rule collapses transitions/animations for users who request reduced motion.

## Responsive contract

Stage 7 adds explicit Progress breakpoints at 980 px, 780 px and 480 px.

Key behaviour:

- wide screens retain compact multi-column performance cards;
- medium screens reduce selected-range metrics to three columns and then two;
- small screens keep orientation/range metrics readable in two columns where useful rather than creating a very long one-card-per-row feed;
- the range control becomes a full-width horizontally safe control on narrower screens;
- chart heights are reduced on mobile;
- Assessment status cards remain compact;
- Stage 6 Test/Development content retains its existing one-column narrow-screen behaviour.

Rendered interaction tests and source-level responsive/brand contracts protect these behaviours. The connected execution environment did not expose a usable browser runner for a screenshot-based preview inspection, so Stage 7 does not claim a manual/automated screenshot review. The branch Vercel deployment, production build, jsdom interaction tests and responsive stylesheet contracts are the verification sources used here.

## Legacy Stats parity decision

**Decision: retain the legacy Stats compatibility layer through Phase 3 and Stage 8.**

Progress now supersedes the navigation identity and provides the new structured Training, Assessment and Development Progress experience, but it does not yet truthfully reproduce every historical statistic in the old Stats implementation.

The retained legacy layer still uniquely exposes historical values including:

- Best cardio speed;
- Best cardio distance;
- Most active day;
- Most active week;
- legacy Weekly chart;
- Most improved this month based on legacy strength volume;
- existing exercise/cardio/strength record and history views.

Removing the old Stats block in Stage 7 would therefore hide genuine historical information. That would violate the Phase 3 requirement to preserve existing Stats functionality until Progress parity is proven.

Progress remains rendered **before** `progressLegacyStats`, and the bridge now explicitly says **Legacy workout history retained below** so the compatibility layer is deliberate rather than looking like accidental duplicate UI.

A dedicated source regression test locks both sides of this decision: Progress must remain first, and the still-unique legacy statistics must remain present until a future parity migration explicitly replaces them.

## Implementation

New Stage 7 modules/tests:

- `src/engine/progressTrainingRangeEngine.js`
- `src/engine/progressTrainingRangeEngine.test.js`
- `src/engine/progressTrainingRangeViewModel.js`
- `src/engine/progressTrainingRangeViewModel.test.js`
- `src/components/progress/ProgressDashboardStage7.css`
- `src/components/progress/ProgressDashboardStage7.test.jsx`
- `src/components/progress/progressLegacyParityStage7.test.js`
- `src/components/progress/progressStage7BrandResponsive.test.js`

`ProgressDashboard.jsx` was mechanically integrated with the range model and Stage 7 stylesheet while retaining the Stage 5 training components and Stage 6 Assessment/Development detail components.

A temporary guarded integration path was used for the dashboard patch. The first JavaScript patcher failed to parse before touching product code because nested JSX template literals conflicted with the patch script's own template literal. It was replaced by a guarded Python patcher, which applied the intended integration. All temporary Stage 7 patch workflow/script files were then removed from the feature branch.

## Regression findings during Stage 7

The combined gate exposed one stale Stage 6 assertion after the deliberate bridge copy change from `More training history below` to `Legacy workout history retained below`. The rendered product was correct; the older test was updated to preserve the same bridge-exists contract using the Stage 7 wording.

A final product-quality review also tightened the This-month chart so it cannot imply future zero-performance days and converted All-time chart labels from raw `YYYY-MM` keys into readable month/year labels.

## Feature-code verification

Feature-code head before the Stage 7 documentation commit:

`5d6f89342c7c890314e10f87ec986f795a126858`

Permanent Workout Tracker CI run #335 / ID `34463481846`:

- 47/47 test files passed;
- 410/410 tests passed;
- Vite 8.2.2 production build passed;
- 673 modules transformed;
- npm audit: 0 vulnerabilities;
- exact-head Vercel status: success.

## Documented-head verification

Stage 7 documentation head `a55ffdd0c3a418cd6bb2c6e1d9039ecd8ee75267` passed permanent Workout Tracker CI run #336 / ID `34463764023`, and the same exact SHA received a successful Vercel deployment status.

This final verification-record edit is documentation-only; Stage 8 will perform the next full exact-head release gate before merge.

## Production data safety verification

Read-only Supabase verification after the Stage 7 feature code:

- workout logs: 499;
- structured Session logs: 0;
- Assessment runs: 0;
- Assessment Test results: 0;
- active recurring Assessment schedules: 2;
- active Development Tags: 10;
- Test/Development-Tag links: 48;
- Paul plan fingerprint: `a715c519932be388cebe88722439de8b`;
- Wilf plan fingerprint: `278e036e425e2eeff7b02b417029403f`;
- Xander plan fingerprint: `b3b95dc0668da96dfcfeccdea21b6cfe`.

No Stage 7 database writes, schema changes, fake Session history, Assessment history, legacy-log rewrites or silent plan changes were made.

## Stage 7 exit decision

With the shared structured-training range contract, dark-first responsive Progress presentation and explicit legacy Stats compatibility decision in place, Phase 3 can proceed to Stage 8 without deleting historical functionality.

## Next

**Phase 3 / Stage 8 — full regression, final PR/release gate, merge to `main`, production deployment and post-deployment verification.**
