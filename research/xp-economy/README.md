# Amending the current earned-XP economy

13 October 2026. Evaluation only; no production files or live scores changed.

This recommendation supersedes the separate competition-economy recommendation in `research/scoring/README.md` and the earlier PDF. Existing group rankings already use earned XP and exclude cosmetic reward XP. Keep that architecture.

## Recommended candidate

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

## Implementation plan

1. Agree the candidate relative-gain scale, minimum-history rule and daily budget. Check expected weekly earning pace against real representative logs and avatar thresholds. Do not rewrite historical XP to keep the cosmetic economy stable.
2. Add a dated rules version to the existing shared engine. Keep legacy scoring for pre-activation dates. Use one earned-XP result everywhere, including groups; exclude cosmetic bonuses exactly as today.
3. Implement daily aggregation, one category bonus, type-specific walking factors, bounded tasks and work-weighted improvement. Show raw and applied cap amounts in debug/user breakdowns.
4. Add explicit mobility/strength/skills classification to block and Session editors and snapshots; collect mobility minutes or hold times. Map Session sets to ordinary set facts. Assign durable set/performance IDs. Avoid classifying by names.
5. Add a shared required-work completion helper, using dated required-target snapshots and optional/cancelled-work rules. Use it in Log, calendars, XP and streaks. Credit actual performed-before-cancellation work once, without erasing unfinished required targets.
6. Run the revised scorer alongside existing scoring on representative data, including Paul/Xander, without writing new totals. Test reward/leaderboard parity, old-score preservation, recovery, offline sync, concurrency, copied sets and regressions. Resolve legacy-data warnings and check average weekly XP/unlock pace.
7. After acceptance, deploy app and group backend together and activate on an agreed fresh Monday. The 19 October date in test fixtures is not a scheduled activation. Keep a versioned rollback path and publish the rate changes.

## Remaining integration work

This is a reproducible candidate wrapper around the real current engine, not a production patch. UI/permission checks, immutable target snapshots, durable set/protocol identifiers, task settings constraints, missing-duration prompts, offline reconciliation, actual user calibration, app/backend deployment and cap-aware debug-field updates remain to be built. The preview assumes explicit classification and target data where tested; it does not invent the missing evidence in older logs.

The proposed three-leaderboard/time-based scoring lab remains useful research but is not needed for this focused amendment. Paul/Xander screenshots do not expose actual per-set improvement percentages or full histories, so their exact new earned XP cannot yet be stated.
