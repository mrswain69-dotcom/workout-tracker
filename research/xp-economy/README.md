# Amending the current earned-XP economy

13 October 2026. Evaluation only; no production files or live scores changed.

This recommendation supersedes the separate competition-economy recommendation in `research/scoring/README.md` and the earlier PDF. Existing group rankings already use earned XP and exclude cosmetic reward XP. Keep that architecture.

## Deeper review: revised recommendation

The best direction remains amending the shared earned-XP engine. The exact weighted preview below is **not ready for production**. The deeper review found six reproducible gaps; the proposed daily caps and history thresholds should remain provisional.

A read-only replay of 36 logged dates across the two profiles discussed, from 31 August through 12 October, reproduces their 12 October existing scores exactly: 255 and 91 earned XP. With hypothetical activation at the start of that window and no invented classification, the candidate gives 114 and 62 on that date. Across the available window, profile A changes from 1,563 to 1,078 (-31.0%); profile B from 645 to 457 (-29.1%). These are preview outputs, not corrected awards or evidence that either reduction is fair. This is two profiles, not population validation. Empty/rest/cancelled logs are included in the 36 dates.

Improvement XP falls from 390 to 29 and from 70 to 1 respectively. Three-history-date eligibility and baseline selection contribute to that reduction. All 122 recorded blocks lack the new explicit `activityPurpose` classification. Existing cardio targets are also represented by `targetText`, whereas the preview expects numeric targets. The scorer therefore cannot reliably apply all proposed classification and target checks to existing data. Raw logs remain outside the repository.

| Reproduced gap | Result in current candidate | Required change before release |
| --- | --- | --- |
| Twelve equal repetitions logged as one set or twelve sets | Strength component 7 versus 29 XP | Define a valid work unit; durable IDs alone cannot establish that twelve genuine sets occurred |
| Unchanged strongest set, weaker set omitted | 0 becomes 2 improvement XP despite less work | Compare like-for-like sets/protocols and bound rewarded work to matched baseline coverage |
| Empty Session marked completed | 20 earned XP including completion | Require meaningful completed work evidence; retain generic compatibility awards only with explicit eligibility |
| One repetition against a twelve-repetition target | Counts as complete | Snapshot and validate actual target semantics, including optional/extra/recovery work |
| Ancient cardio baseline | Still earns improvement after more than a year | Apply the same freshness and comparability requirements across activity types |
| 180-day streak milestone | 617 uncapped becomes 150 total earned XP | Calibrate budgets and milestone treatment before adding a hard all-component cap |

The exposure tests pass because they assert the observed flaws. They are diagnostic evidence, not successful fairness acceptance tests. There are 24 original candidate checks, six exposure checks plus their result-writing check, and 17 existing XP/integration/streak tests, all passing (48 total). Run `node --test research/xp-economy/deeper.checks.mjs research/xp-economy/evaluate.checks.mjs`. `shadow.mjs` replays local private input without writes to the database.

Revised implementation sequence:

1. Keep the existing earned-XP group architecture and historical scoring. Start with daily aggregation, removal of per-block/rounding advantages, per-type walking factors and trustworthy duplicate handling. Do not claim this fixes cross-sport equivalence.
2. Add explicit activity classification, durable work/protocol identities and immutable required-target snapshots. Resolve real field mappings and meaningful Session completion. Target completion concerns scheduled work; extra activity must not make an otherwise completed planned day incomplete.
3. Prototype improvement on matched work under the same unit, exercise variant and protocol. Do not compare a mixed-unit `scoreSets` total as a universal strength-performance measure. Reject cherry-picked or insufficiently comparable evidence; reward additional volume as volume rather than a fabricated performance gain. Recheck new-program onboarding so three prior dates does not unduly suppress legitimate progress.
4. Repeat the read-only comparison after those changes, with recovery, novices, changing plans, mixed activities, reward-unlock pace and weekly rankings. Tune progression scales and budgets then. Hold back the 150/100 hard caps until this calibration resolves milestone treatment and earning pace.
5. Release app and group scorer together using a dated version, unchanged historical awards, parity checks and rollback. No activation date or production change is scheduled by this research.

## Experimental candidate evaluated

Use the existing shared XP engine with daily aggregation and work-weighted relative improvement. Keep 2 XP per genuine logged strength set, current cardio minute/distance rates, and the current duration rate. Group equivalent work across block names and ordinary/structured Session formats. Aggregate before rounding. Award the 5 XP category activity bonus once per day, not per block. Apply the walking factor only to walking work.

For each stable movement/protocol identity, compare average recorded performance per set with the greater of its recent daily-median baseline and latest comparable performance. Require three prior comparable dates; new IDs do not automatically earn improvement. A candidate 1% minimum gain avoids tiny changes. Weight the gain by actual comparable sets, not number of movement names:

`strength improvement XP = round(sum(comparable sets * 2 * min(relative gain, 20%) * 5))`.

Examples: a 5% gain adds 25% of that work's base set XP; a 20% gain adds 100%. Unimproved work adds nothing. Adding more sets is volume, not improvement in per-set performance. Repeating yesterday's same result adds no improvement award. These calibration constants are candidates; they are not physiological equivalence claims.

For cardio, use the same work-weighted principle with a matching activity/protocol and recent comparable pace baseline. Strength and cardio improvement share a 100 XP daily ceiling. Cap the other earned components (including task, daily, completion and streak awards) at 150, giving 250 total earned/day. Cosmetic reward XP remains separate. Task XP contributes at most 15/day; approval and rate calibration are still required for unusually configured tasks and large streak milestones.

## Evidence

24 evaluation tests pass, plus 17 existing production XP/integration/streak tests. `results.json` contains the numerical comparisons. Execute:

```sh
node --test research/xp-economy/evaluate.checks.mjs
```

| Equivalent work, different entry layout | Existing earned XP | Recommended preview |
| --- | --- | --- |
| 12 sets in one / three blocks, 20% improvement | 69 / 79 | 63 / 63 |
| 12 sets across three / six movement labels, 20% improvement | 69 / 99 | 63 / 63 |
| 20 mobility minutes in one / twenty blocks | 19 / 130 | 19 / 19 |
| 3 km / 30 minute run in one / ten blocks | 36 / 90 | 36 / 36 |
| 12 strength sets in standard / classified Session format | 39 / 20 | 39 / 39 |
| 8 mobility minutes in strength / duration format | 31 / 17 | 17 / 17 |
| Only one of three required movements logged, one / three blocks | 23 / 13 | 13 / 13 |

A flat 30 XP daily improvement award also removes movement-name inflation but awards the same amount for a 2% and a 20% gain, and gives the same improvement award for 6 and 24 comparable sets. The weighted candidate distinguishes those without paying for additional labels. The numeric comparison uses constructed logs with three prior comparable dates, not audited Paul/Xander records.

Tests also cover genuinely larger workouts, insufficient history, repeated performance, duplicate stable set IDs, cancelled retained data, future streak eligibility, physio/illness, total caps, ordering and exact preservation of historical full score rows. The 120-movement partition sweep is a stress test, not a typical workout or proof of cross-sport physiological equivalence.

## Completion and classification

Future completion must check recorded required sets/targets; one entry in a large block is not automatic completion. Corrected completion also feeds future streak bonuses. Classification is explicit: mobility uses actual minutes or recorded hold seconds; strength in a Session uses its recorded strength sets. A classified block without mobility duration reports missing data. Generic completed Sessions without quantitative work retain one daily compatibility award and a visible warning; that is not equivalent-work scoring. A later capture change is needed to remove the compatibility fallback reliably.

No mandatory whole-workout timer is needed for the core changes. Sets remain a unit of recorded strength work. One genuine set falsely reported as several newly identified sets cannot be detected just from existing numeric logs. Stable set IDs, source deduplication and completion evidence improve this, but meaningful effort and truthful reporting still matter. Never describe this proposal as a perfect measure of physiological effort.

## Original implementation outline (revised sequence above takes precedence)

1. Agree the candidate relative-gain scale, minimum-history rule and daily budget. Check expected weekly earning pace against real representative logs and avatar thresholds. Do not rewrite historical XP to keep the cosmetic economy stable.
2. Add a dated rules version to the existing shared engine. Keep legacy scoring for pre-activation dates. Use one earned-XP result everywhere, including groups; exclude cosmetic bonuses exactly as today.
3. Implement daily aggregation, one category bonus, type-specific walking factors, bounded tasks and work-weighted improvement. Show raw and applied cap amounts in debug/user breakdowns.
4. Add explicit mobility/strength/skills classification to block and Session editors and snapshots; collect mobility minutes or hold times. Map Session sets to ordinary set facts. Assign durable set/performance IDs. Avoid classifying by names.
5. Add a shared required-work completion helper, using dated required-target snapshots and optional/cancelled-work rules. Use it in Log, calendars, XP and streaks. Credit actual performed-before-cancellation work once, without erasing unfinished required targets.
6. Run the revised scorer alongside existing scoring on representative data, including Paul/Xander, without writing new totals. Test reward/leaderboard parity, old-score preservation, recovery, offline sync, concurrency, copied sets and regressions. Resolve legacy-data warnings and check average weekly XP/unlock pace.
7. After acceptance, deploy app and group backend together and activate on an agreed fresh Monday. The 19 October date in test fixtures is not a scheduled activation. Keep a versioned rollback path and publish the rate changes.

## Remaining integration work

This is a reproducible candidate wrapper around the real current engine, not a production patch. UI/permission checks, immutable target snapshots, durable set/protocol identifiers, task settings constraints, missing-duration prompts, offline reconciliation, actual user calibration, app/backend deployment and cap-aware debug-field updates remain to be built. The preview assumes explicit classification and target data where tested; it does not invent the missing evidence in older logs.

The proposed three-leaderboard/time-based scoring lab remains useful research but is not needed for this focused amendment. The read-only replay above now supplies actual-log candidate outputs; missing classification and target semantics still prevent treating those outputs as final fair awards.
