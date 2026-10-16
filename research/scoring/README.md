# Workout Tracker scoring evaluation - 13 October 2026

Status: research prototype only. Nothing in production imports this directory. No scoring activation date is configured, no database writes are made, and no leaderboard or lifetime XP totals change.

## Reproduce

```sh
node --test research/scoring/engine.checks.mjs
node research/scoring/compare.mjs
```

33 named tests pass. The partition tests include 1,200 generated equality comparisons across 1-200 partitions, not 1,200 observed human workouts. Separately, 17 existing production XP, integration and streak tests pass. `results.json` records candidate comparison results. The comparison runs against a normalized input contract, with an adapter for representative native log shapes.

## Recommended architecture

1. Keep personal earned XP separate from competitive ranking and cosmetic reward XP.
2. Offer Activity, Improvement and Consistency leaderboards. Overall ranking is optional and initially a beta using 50/25/25 weights. Synthetic sensitivity tests change the winner when weights change; they do not establish objectively correct weights.
3. Prefer recorded training time, with explicit activity purpose, over repetition/set counts for cross-activity competition. It removes layout and repetition-count biases but cannot establish equal physiological effort. Support a coarse effort/protocol classification only after calibration; do not directly rank calories, absolute loads, age or body weight.
4. Use work-unit estimates temporarily for personal progress where duration is missing. Mark estimated records provisional. Avoid silently estimating time from the number of sets, since splitting sets changes the estimate.
5. Normalize Sessions and conventional blocks into the same facts. Labels and block boundaries never award points. Maintain stable event, requirement and benchmark identities.

## Candidate rules implemented in the lab

These rates are transparent calibration candidates, not fitness recommendations or validated equivalence factors.

| Metric | Candidate formula |
| --- | --- |
| Activity credits | Recorded minutes x purpose factor; strength/cardio/skills 1.0, walking 0.6, mobility 0.4. Recovery/tasks add no athletic activity credits. |
| Daily activity score | `100 * min((min(c,30) + 0.5 * max(0,min(c,60)-30))/45,1)`; retain two decimals only after aggregation. |
| Weekly activity score | Sum daily credited amounts after diminishing returns, then `100 * min(sum/150,1)`. Training frequency and duration still matter up to the ceiling. |
| Benchmark baseline | Median of daily median results in the previous 42 days, same key/protocol/unit/direction; at least three prior dates spanning seven days. |
| Improvement score | Relative gain / 10%, capped at 100; gains below a candidate 1% noise floor receive zero. For lower-is-better results use baseline/current - 1. Fixed 1-3 benchmark slots; average across configured slots. Missing slots prevent eligibility for overall ranking. |
| Weekly improvement | Median score per benchmark, then average across benchmarks. Repeating a benchmark on more days does not create extra ranking points. |
| Improvement XP | Up to 100/day, but only for a result at least 1% beyond the persisted previously rewarded watermark for that benchmark/protocol. The lab takes that watermark as input; production needs atomic persistence and calibration of the candidate 1% significance/noise policy. |
| Consistency | Required canonical target completion, bounded at 100%; optional work excluded. Frozen weekly schedule includes scheduled dates without logs. Approved recovery amendments are auditable. |
| Activity/personal XP | Round daily activity score x 1.2, plus 5 showing-up, 10 plan completion, personal tasks capped at 15, and 5 appropriate recovery; entire bucket capped at 150. These awards fit inside the 150 bucket, not above it. |
| Total earned XP | Activity/personal bucket <=150 + fresh improvement bucket <=100 = <=250/day. Cosmetic reward XP stays separate and is not ranked. Existing milestone awards need an explicit budget decision before integration. |
| Overall | Weekly Activity 50%, Improvement 25%, Consistency 25%; unavailable when required evidence is missing. Do not renormalize weights for beginners. They can compete on eligible individual boards. |

## Normalization and evidence contract

`engine.mjs` accepts explicit per-day facts. Events carry stable IDs, declared purpose, recorded minutes or seconds and optional repetitions/distance, plus immutable requirement identities. Exact repeated events deduplicate; conflicting duplicates and overlapping timer intervals reject scoring until reconciled. New IDs alone cannot prove that reported work is genuine; production must reconcile source provenance and imports.

`adapter.mjs` reads ordinary strength sets, cardio/duration logs, structured Session set results, recovery and task completion. Existing duration fields are recorded claims; their reliability is separate from their numeric presence. The adapter does not infer mobility from exercise names. Completed Sessions without duration and strength without duration are flagged as provisional. Native block-derived IDs are a migration aid, not sufficient permanent deduplication IDs. Timers must be pauseable and imports/manual entries reconciled, with day boundaries resolved in the profile's timezone.

Required targets must be snapshotted independently from current editable plans. Server-controlled benchmark slots/protocols, role-aware amendments, validated timer records, and atomic reward watermark updates are not implemented in this isolated engine. These are mandatory integration steps, not capabilities demonstrated by the pure tests.

Cancellation discards retained entries unless there is explicit performed-before-cancellation evidence. Such performed work receives its activity credit, but remaining targets do not disappear. Recovery can satisfy approved recovery targets without being scored as high-intensity activity. Tasks do not complete physical targets.

## Findings and limits

- Same recorded strength work in 1-200 partitions, or inside a Session, has equal candidate scores.
- 20 minutes represented by 24 versus 240 repetitions earns 2.67 versus 26.67 activity points under the unit model; the recorded-time model gives 44.44 to both. This is an architectural comparison, not proof of equal effort.
- 20 mobility minutes in one or twenty blocks gives 17.78 points; a 3 km/30 minute run in one or ten blocks gives 66.67 points. Total before rounding fixes the original rounding incentives.
- Adding a six-second run to a 30-minute walk changes activity points from 40 to 40.22, not the reward for the whole walk.
- No benchmark baseline means no improvement ranking, rather than a zero suggesting failure. Missing times mean provisional activity. Neither is a reason to discard personal history.
- The earlier caps-only simulation left movement-count, rounding, Session and completion advantages. It is not the recommended rollout.
- Paul/Xander screenshots show 91/255 earned XP and 12/40 sets, but displayed 25/55 minutes include estimates. New audited scores cannot be reconstructed without source logs, classifications, recorded durations, personal benchmark histories and required-work snapshots. Do not present screenshot-based estimates as actual new awards.
- Pure synthetic tests establish invariance, limits and deterministic behaviour. They do not establish physiological equivalence, optimal rates, honest reporting, real-user fairness, or production account isolation. Those need a shadow run, field feedback and integration tests.

## Implementation sequence and acceptance gates

1. **Data contract and rules version:** settle rate candidates, improvement significance, daily minimum showing-up requirement, milestone XP budget and treatment of different effort protocols. Define profile-local date boundaries, activation week, canonical IDs and snapshot lineage. Preserve legacy scoring functions for pre-activation dates.
2. **Capture and classification:** add explicit purpose in block/Session editors, a pauseable training timer or actual duration entry, estimate labels, Session-to-purpose mapping, source IDs and import/manual overlap reconciliation. No naming heuristics.
3. **Persistence and control:** store frozen weekly schedules, benchmark choices/protocols, recovery/illness amendments, immutable score versions, prior rewarded watermark and audit records. Enforce ownership and roles server-side. Use atomic idempotent awards; test races, retries and edits.
4. **Shared shadow scorer:** wire canonical adapters into the same scorer used by app and group backend. Recompute a read-only comparison over real consenting profiles. Keep legacy totals authoritative. Require app/backend exact parity and no production score writes.
5. **Competition and explanation UI:** show three boards, evidence eligibility, optional overall beta, point components, caps, verification and estimate status. Explain incomplete work without penalising a lack of history. Personal rewards and body-readiness metrics remain separate.
6. **Calibration and release:** examine at least two weeks of diverse real logs across families, new members, strength/cardio/skills/mobility and recovery. Compare rates and weights, resolve false flags, and publish the final rules. Activate on a fresh Monday only after data coverage and fairness gates pass; no date is chosen in this lab.

Release gates: equivalent logged work scores equally regardless of names/layout/format; no repeated or overlapping awards; untouched historic earned/reward XP and unlocked avatars; authentic recovery respected; no premature completion; fixed-schedule denominator includes missing days; estimates never rank as verified duration; server ownership/permission isolation; offline sync and concurrent-write idempotency; credible privacy-safe comparisons on real data; app/backend shared version and rollback path.

Rollback turns off new competitive scoring for the affected week and retains the recorded events and score-version audit. Never erase previously awarded legitimate rewards as part of rollback.
