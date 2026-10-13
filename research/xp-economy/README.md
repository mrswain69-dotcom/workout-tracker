# Amending the current earned-XP economy

13 October 2026. Evaluation only; no production files or live scores changed.

This recommendation supersedes the separate competition-economy recommendation in `research/scoring/README.md` and the earlier PDF. Existing group rankings already use earned XP and exclude cosmetic reward XP. Keep that architecture.

## Explainable plan-first policy experiments

User direction: reward following an appropriate self-chosen plan, habits and personal progression; extra work can help, but should not dominate or require changing training purely to earn XP. XP rules must be visible and easy to explain.

Added `simple-plan.mjs`, 55 tests in `simple-plan.checks.mjs`, and `simple-plan-results.json`. These simulate explicit accepted plans, completion fractions, actual durations and qualified progression facts. They do not claim to derive those facts reliably from legacy logs. All 145 research tests and 17 existing production XP/integration/streak checks pass (162 total), including diagnostic tests intentionally demonstrating unresolved weaknesses. Two new partition sweeps each check 120 activity layouts.

### Compared policies

Five policies were simulated: fixed daily plan rewards of 60 or 40, an unrestricted 180-XP weekly adherence allowance, a guarded weekly allowance of 180 with 60/60 progress/activity caps, and a guarded higher-pacing version with up to 300 plan XP and 100/100 progress/activity caps. The daily policies give more plan XP solely for having more planned days. The unguarded weekly allowance gives a one-minute one-day token plan 180 adherence XP; this is unacceptable as a default.

The guarded higher-pacing version is the strongest candidate **for another policy/capture trial**, not a production-ready scoring engine. Its entire earning schedule can be shown in a small table:

| Component | Trial visible rule | Limit |
| --- | --- | --- |
| Follow the accepted plan | One planned training day makes 100 adherence XP available; two make 200; three or more make 300, divided across the scheduled days. Earn the completed fraction. | 300/week |
| Personal progress | 10 for beating last comparable workout; 20 for beating the rolling baseline; 30 for a new established lifetime best. Apply only the highest qualifying tier that day. | 100/week |
| Recorded activity | First 30 minutes: up to 10 XP; next 30: up to 5; next 60: up to 5. Proportionate credit within each band. Planned work and extras consume the same daily allowance. | 20/day, 100/week |

All figures are hypothetical calibration values. At most 500 earned XP/week is available in the higher-pacing trial, with adherence 60% of the maximum budget. In these rules a one-day schedule can earn at most 150 in that day, below the existing specification's 250 absolute daily limit. Lifetime earned XP does not reset when the weekly allowance renews. The prototypes omit current daily claims, tasks and streak XP from candidate earned totals; those cannot be silently added outside the new budgets. Recovery, illness, approved schedule changes and streak treatment remain explicit integration/policy work. Existing awarded totals, badges, avatar claims and frozen results are untouched.

Guard against token plans: the trial prorates adherence below **10 actual planned-work minutes**; e.g. one minute earns at most 10% of its available daily adherence award. Unplanned extra activity cannot fill this guard. Ten minutes is an arbitrary product-test parameter, not a health recommendation or a settled universal minimum. Short rehab and legitimate short habit plans need an accepted alternative path. The prototype requires a trusted link between activity and required planned work, not a user-editable flag in production. A manual actual-duration entry is possible; no mandatory timer or wearable advantage is implied.

### Representative simulated results

All examples below fully complete their hypothetical accepted weekly plans, have adequate planned activity duration, and receive **no progression awards**:

| Scenario | Trial weekly XP |
| --- | ---: |
| Three days with dog walk, run, mobility and weights; 140 minutes/day | 360 |
| Five gym days; 90 minutes/day | 387.5 |
| Five gym days plus rugby training on one gym day and a match on a sixth day | 400 |
| Three one-hour pool sessions and three separate one-hour gardening sessions | 390 |
| Three one-hour planned workouts | 345 |
| Five one-hour planned workouts | 375 |

The close scores are a consequence of the declared plan allowance and activity limits, not evidence of equivalent physical effort. Purposeful extra work still contributes: a 60-minute day earns 15 activity XP; extending it to 90 minutes adds 2.5. Beyond 120 minutes that day, more work remains in the history but earns no additional activity XP. Changing the order of gym, walk or other blocks does not change the score. A separate new block receives no fresh full-rate allowance.

A three-day one-hour plan with verified-in-the-fixture rolling-baseline improvement on each day earns 405, while five unchanged 90-minute gym days earn 387.5. This checks the intended direction of incentives; the test passes trusted improvement facts and does not implement physiological improvement detection. An unplanned seven-day grind with maximum qualified progress earns at most 200, below a fully completed three-day one-hour plan's 345. Current pure set/block counts do not enter these scores, so two substantial sets versus twenty shorter sets with identical trusted completion and actual duration receive equal XP. That invariance is conditional on truthful completion/time; it does not certify how to derive those inputs.

### What is successfully bounded

Tests cover block and set-count invariance, daily accumulation before diminishing returns, activity order, extra-flag bypass, no per-block rounding awards, source replay on the same or a different date, conflicting planned/extra labels, weekly progress and activity ceilings, non-stacking improvement tiers, missing prior history, no award for merely repeating a record, accepted snapshots, partial completion, invalid input and input immutability. Existing effort after the reward limit still appears in history.

### Remaining exploits and product tradeoffs

The tests intentionally reproduce these issues. Passing them is diagnostic evidence, not a claim that the system is cheat-proof:

* Reducing future commitments from five days to three while doing the same three workouts raises adherence XP from 180 to 300 in the higher version. The accepted snapshot prevents editing away missed days retrospectively, but cannot alone judge whether a prospective easier plan is appropriate. Personalized plan acceptance and meaningful goals are the main unresolved fairness gate.
* The ten-minute guard prevents one-minute token plans receiving full XP, but a genuinely completed modest ten-minute plan still receives the same adherence award as a longer appropriate plan. This reflects adherence-first scoring, not fitness ranking. Arbitrary self-approved plans can still exploit that distinction.
* Identical minutes spread across two days can earn more activity XP than on one day (120 minutes in one day = 20; two 60-minute days = 30). The weekly cap bounds the difference. This deliberately supports regular activity, but means schedule layout still matters across days. If total weekly work must have identical activity XP regardless of schedule, the activity bands should run weekly instead; that is a different policy choice.
* Distinct IDs for the same manual/wearable activity can double count it. Source-ID deduplication alone cannot detect overlapping time or duplicate observations; the capture adapter needs activity matching and interval reconciliation.
* A small easy movement's claimed PR could unlock the same daily progress tier as substantial improvement. Qualifying progression must be grounded in comparable meaningful work and accepted goals, rather than any improved label. No genuine-work threshold for that is settled here.
* Universal minutes are transparent, but do not equalize walking, swimming, weights or gardening physiologically. Estimated programme duration cannot be substituted for recorded actual activity. Choosing time as a bounded secondary component deliberately limits that approximation's impact; still confirm that users accept the recording burden.

### Reward pacing

In the higher-pacing no-progress examples, 345–400 earned XP/week makes a 1,000 XP gap about 2.5–2.9 weeks, a 2,000 gap about 5.0–5.8 weeks, and a 5,000 gap about 12.5–14.5 weeks. At the 500 maximum, those gaps take 2, 4 and 10 weeks. These calculations use sustained hypothetical rates without cosmetic badge bonuses, existing balances or interruptions. They are not forecasts for Paul/Wilf/Xander. A journey from zero to 120,000 at 390/week would take about 308 weeks before other reward sources, so long-horizon pacing needs deliberate review. Existing avatar thresholds remain the authority and were not changed.

The next recommended experiment is to validate trusted plan completion, appropriate prospective plan changes and meaningful progression qualification, then compare the 180/60/60 versus 300/100/100 budgets against real captured weeks and desired reward intervals. The weekly plan structure offers clearer control than per-set/per-block XP. It still needs these gates before release. Keep the shared earned-XP economy and show the weekly budget and each applied band/tier in the user's breakdown.

## Earlier actual-log comparison and revised baseline recommendation

13 October 2026. Queried all 540 saved records for the three relevant family profiles read-only (167 / 167 / 206), recovered the research branch, and verified that the current main XP source remains at production base `b0b9ab9018b40df33dd39adbc1b50fb1253ff043`. No new scoring was activated. Group history scope begins 12 September 2026; the primary comparison uses 12 September through 12 October, with all prior records available for history and matched probes limited to 28 days. Schedule snapshots are passed exactly as the group backend does. Aliases A/B/C are used in saved aggregate reports; raw profiles, plans, notes, movement names and log payloads are not committed.

### What was compared

`actual-replay.mjs` adapts actual recorded strength/cardio/duration work to the revised aggregation contracts. It retains strength-format holds as strength when explicit mobility classification is absent; it does not classify by movement name. One trace identity per original entry makes the transformations reproducible; these are replay-local identities, not newly certified or persisted set IDs. The existing scorer counts all retained strength set data, including orphan movement IDs; the adapter does the same for base scoring. Cancellation exclusion is a separate sensitivity, so it is not hidden in an aggregation-only result.

There are three scenarios: the existing earned-XP engine; aggregation only (base strength/cardio/duration categories changed, other components unchanged); and an exploratory matched-strength-improvement preview. The exploratory preview uses the provisional weighted scale from the earlier lab, rejects dropped weaker slots, compares repetitions at fixed load or load at fixed repetitions, and uses only the best qualifying probe rather than stacking both. Missing ordinal entries are not renumbered. Recorded hold times have a separate probe. Unit identity and positional set matching remain assumptions because legacy logs do not certify them. Cardio improvement, Session awards, recovery, tasks, daily claims, completion and streaks remain legacy in these preview totals. No overall daily cap or revised completion policy is applied. These are isolated experiments, not final all-rule competitive scores.

### Actual earning effects

| Profile alias | Current earned XP in comparison period | Aggregation only | Change | Exploratory matched preview with one prior comparable date |
| --- | ---: | ---: | ---: | ---: |
| A | 695 | 670 | -3.6% | 602 |
| B | 493 | 453 | -8.1% | 429 |
| C | 1,563 | 1,438 | -8.0% | 1,189 |

On 12 October, current / aggregation-only / exploratory one-prior-date totals are 91 / 91 / 69 for A and 255 / 235 / 130 for C. C's 500 cosmetic bonus XP stays excluded from each earned-XP comparison. Neither exploratory result is a promised award. These figures differ from earlier previews because the newer experiment substitutes only defined components and uses matched metric probes rather than the mixed-unit average `scoreSets` formula.

### What is proven about layout

The full-history replay passes 4,320 layout transformations; 2,968 are on nonempty base-activity dates (371 dates), the rest are empty controls. It also passes 540 replay deduplication checks, 540 historical-row preservation checks and 63 omission checks on eligible inferred comparisons. The deduplication checks preserve replay identities; they cannot prove that existing logs natively deduplicate imported or copied work.

For 216 actual strength blocks with multiple logged sets, an isolated current-engine replay compares the same work in one block with the same intact sets distributed across separate blocks. It confirms the existing component rises solely due to five-XP block awards. For example, 12 unchanged sets give 29 versus 84 strength XP under the current engine; the revised aggregate is 29 in either layout. This is the **strength component**, not whole-day earned XP. The aggregation prototype also eliminates cardio/duration partition and rounding advantages without changing the actual recorded distance or duration.

This demonstrates removal of specific representational biases. It does not prove equal physiological effort between workouts, fairness of every rate, truthful set reporting, or fairness of a changed weekly winner.

### Baseline sensitivity changes the recommendation

| Minimum prior comparable dates | A eligible movement comparisons | B eligible movement comparisons | C eligible movement comparisons |
| --- | ---: | ---: | ---: |
| 1 | 8 / 19 | 14 / 42 | 84 / 145 |
| 2 | 2 / 19 | 0 / 42 | 39 / 145 |
| 3 | 1 / 19 | 0 / 42 | 19 / 145 |

All three-date rejections in this comparison arise from insufficient recent **matching** history. This includes changed protocols and sparse/new-plan identities; it is not equivalent to saying those users had no previous training. The three-date gate systematically favors repeated stable plans and should not be the sole gateway to every improvement award. A two-date gate still leaves B with zero eligibility. The one-date variant passes the same omission protection used by the three-date variant, although this does not establish full resistance to manipulated baselines.

Revised recommendation: allow modest, work-weighted **beat-last-comparable-workout** recognition after one genuine prior comparable date; require sufficient multi-date evidence for a **rolling-baseline** award. Do not stack the same underlying gain twice. New work without comparable history earns base activity XP. Exact tier scales, baselines and caps still require calibration. This remains one shared earned-XP economy, not a separate competition currency. Canonical movement/protocol IDs should preserve comparability across copied/new plans where the exercise genuinely stays the same, without matching unrelated exercises by name.

### Completion and data readiness

Within the group-period sample, nine currently green dates still have fewer logged required sets than the saved movement set counts (A 5, B 1, C 3). This is a provisional count audit: saved requirements can themselves have changed or been adjusted, so it is not proof those users failed their workouts. Other days remain unknown because cardio targets are text, Session completion is a flag, recovery eligibility needs existing policy, or cancelled work lacks an immutable adjustment record. No streak or completion award was removed.

The compared logs contain 358 performed strength sets and 152 recorded blocks: zero native stable set IDs and zero explicit `activityPurpose` classifications. The input also lacks certified immutable per-set/protocol targets. There are therefore zero **certified** improvement comparisons, even where the exploratory adapter finds plausible matches. Full rules cannot safely reinterpret historical logs as if those fields had always existed. Explicit capture and snapshot integration must precede final score activation.

### Historical group-table check

Read the existing frozen group weekly results and compare their highest saved score version with a current-log/current-engine replay. Six of fifteen saved member-week rows differ; some were frozen under earlier score versions, and current records can also have been edited after the result froze. This diagnostic does not identify an app defect or establish a new winner. Saved historical standings remain authoritative and were not modified. Weekly rankings in `actual-results.json` compare scenarios applied to the **same current logs**, not replacements for frozen results. A layout-only reranking of the week beginning 21 September illustrates possible sensitivity; it is not evidence that a past placement was unfair.

### Validation and next implementation step

90 research tests plus 17 existing XP/integration/streak tests pass (107 total). The actual replay additionally runs the data-level assertions above. Ten new adapter tests check orphan sets, cancellation isolation, suspended recovery, missing ordinal slots, changed load protocols, input immutability, privacy of report output, component decomposition, known example scores and history sensitivity. Existing diagnostic tests still assert known flaws and must not be described as full fairness acceptance.

The evidence now supports implementing daily aggregation and trusted identity/classification capture, followed by a two-tier comparison experiment (last comparable workout / rolling baseline). Keep base earning rates stable initially, preserve historical awards and frozen standings, standardize task/daily/streak eligibility, and reconcile the specification's cap/milestone policy before activating a final formula. Genuine extra work should still earn XP; smaller totals alone are not a fairness target. Tests using this one family's logs establish concrete layout behavior, not universal competitive balance.

Reproduce the private replay with `node research/xp-economy/actual-replay.mjs /path/to/private-profiles.json /path/to/aggregate-results.json`. Pass `scheduleSnapshots` alongside each profile's `plan_json` and `records`. Raw input is intentionally not included in the repository. Committed aggregate outputs are `actual-results.json`, `history-sensitivity.json` and `frozen-comparison.json`.

## Earlier revision checks against the supplied specifications

Added research-only contracts in `revision-rules.mjs` and 49 new checks in `revision.checks.mjs`. These operate on normalized facts with trusted IDs, protocol and unit metadata, and saved target snapshots. They are **not integrated into the live log format**, nor a calibrated replacement XP formula. There are 80 research checks plus 17 existing XP/integration/streak checks passing (97 total). The older exposure checks deliberately assert known flaws; their success is not acceptance of the old candidate.

The new checks include 264 layouts/partitions (24 strength layouts, 120 mobility partitions and 120 cardio partitions), replay deduplication, conflicting IDs, invalid numeric input, type/unit mismatches, empty Sessions, incomplete required work, optional extras, approved adjustments, recovery eligibility, changed protocols, new exercises, insufficient and stale histories, duplicate dates, matching-distance cardio, activation boundaries, input immutability and avatar threshold cadence. No new raw-log replay was needed in this round; the prior 36-date replay still evaluates the earlier candidate only.

Matched-work evidence now requires all baseline slots to be represented under the same exercise, protocol, metric, unit and direction. It rejects omitted weaker sets and overall regression; extra unmatched sets cannot multiply the improvement evidence. New exercises still earn base work XP. This is conservative: durable slot identities and canonical units need real capture and migration design, and minimum-history eligibility remains provisional. It does not prove physiological equality across exercise types.

Completion has two separate concepts: **performed required work** and **performance-goal attainment**. Testing strict twelve-repetition attainment showed that an honest ten-repetition completed set would otherwise lose completion credit. The prototype can require explicit completion plus meaningful recorded work while keeping the stretch goal separately. Empty completed Sessions still cannot satisfy missing work evidence. A cancelled target remains required unless an accepted plan adjustment excuses it; completed extra activity does not make another unfinished extra mandatory. These normalized semantics need to be mapped to the current UI before any green-day/streak change.

The attached System Engine Specification v2.0 explicitly calls for a four-week baseline, 150 completion XP, 100 improvement XP and a 250 absolute daily limit, unlike the live rates and milestones. The new evidence tests use 28 days rather than silently carrying forward the candidate's 42 days. Holding back the proposed caps is a deployment/calibration decision, not a recommendation to abandon the specification's anti-inflation requirement. The treatment of large current streak milestones must be reconciled in a deliberate versioned policy change.

The source documents also differ on recovery: Recovery Block Specification v1.0 introduces separate workout/discipline streaks and hard eligibility restrictions, while the already accepted app policy includes injury/illness/recovery paths. The helper accepts established eligibility; it does not implement new recovery penalties. Future-learning insight limits differ between the System Engine and Body Intelligence documents (15/60 versus 20/80 daily/weekly). Those future policies are outside this scoring patch and should not be silently imported.

An additional live-code check confirms that Group rankings sum `earnedXp`, which excludes cosmetic badge rewards **but includes daily claim, configurable task, and streak XP**. Identical physical work can gain 15 more earned XP from a daily claim; one task configured for 100 rather than 5 gives 95 additional earned XP. Standardizing eligibility/rates for these inputs is therefore necessary to address plan-structure advantages. The previously suggested task cap alone does not establish equivalence between different personal tasks. The verification summary's physical-only XP is a separate breakdown, not the group ranking input.

Reward authority remains `AVATAR_PACKS` and existing total XP/claim state; no thresholds or claims were changed. Sensitivity arithmetic shows that a sustained 30% drop in total XP earning rate would lengthen the same unlock interval by about 43%, not 30%. This is an illustrative constant-rate calculation, not a forecast from the two users' earned-only replay. Cosmetic bonuses and changing training frequencies also affect actual unlock pace. The System Engine document's stated `100 + level² * 8` next-level formula totals 328,300 XP for Level 1 to Level 50, whereas its prose estimates 180,000–200,000 and about 3.5 years. That specification discrepancy needs resolution if a level system is used for calibration; this is not evidence that the live app has such a level curve.

Recommendation remains: amend the current shared earned-XP architecture, implement aggregation and trusted evidence, separate completion from target achievement, standardize non-physical earned-XP inputs, then calibrate improvement and cap/milestone treatment on representative data. Keep historical awards and unlocks intact. A base-set scheme still cannot detect fabricated new sets or measure equivalent effort across sports from current numeric logs alone.

Reproduce with `node --test research/xp-economy/revision.checks.mjs research/xp-economy/deeper.checks.mjs research/xp-economy/evaluate.checks.mjs`. The prototype's uncapped base totals are diagnostic quantities; they are not proposed final production awards.

## Earlier deeper review

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
