# Activity XP rules version 4

Version 4 applies to recorded activity dates from 14 October 2026. Version 3 remains authoritative through 13 October. Editing a historic date continues to use its historic rules. No account totals, logs, claims, unlock thresholds or completed competition results are rewritten by this release.

The client, Group Earned XP scorer and season awards ship the same engine and helper files. Rule selection lives in `src/engine/xpRuleVersions.js`. The score provenance version is 4; each ledger row also exposes its own activity-rule version.

| Component | Revised rule |
| --- | --- |
| Strength / HIIT / Box | 2 XP per recorded set, plus 5 once per day across the category |
| Cardio | 1 XP per 2 minutes plus 1 per 0.5 km; aggregate before rounding up; category award 5 once/day |
| Walking | 60% of its Cardio work; walking-only category award 3; mixed days discount only walking work |
| Duration | 2 XP per 10 minutes; aggregate before rounding up; category award 5 once/day |
| Session | 10 XP per completed Session; drill numbers add no XP |
| Recovery / illness / injury | Highest applicable 5/10 award once per day |
| Reps / holds improvement | 0.5 XP per 1% improvement; cap 5 |
| Weighted improvement | 1 XP per 1% paired weight × reps gain; neither weight nor reps may decrease; cap 15 |
| Cardio improvement | 1 XP per 1% time reduction, same sport/exact distance; cap 10 |
| Improvement aggregation | Highest qualifying Strength award and highest qualifying Cardio award per day; cap 25 combined; whole XP rounds down |
| Established PB | 15 earned XP once/day after three prior comparable dates; additional to improvement XP |
| Tasks, day completion, daily challenge, streak | Existing rules retained |
| Badge/avatar claims and Group awards | Bonus XP; excluded from Group Earned XP rankings |

Improvement compares best actual sets on the last comparable date, with stable movement/protocol/unit identity. Added sets alone earn base XP, not improvement. Weighted gains compare actual pairs rather than independent maxima. Both weight and reps gains use their paired product. Cardio compares time reduction, not a mixed-duration or cross-sport score. General Duration has no improvement/PB award.

The PB engine is shared between the daily award and the Personal Bests badge. PB comparisons retain all earlier comparable records. Weighted PBs require three earlier dates supporting the comparable reps/load benchmark. PB days count once regardless of the number of records. Explicit warmup or `progressionRewards: false` entries do not supply performance awards/baselines; base set XP remains. The plan editor exposes Record only and preserves its flag when normalising/snapshotting movements.

Personal Bests tiers: Bronze 1, Silver 3, Gold 5, Platinum 10, Diamond 25, Pro 50, Champion 100, Elite 150, Unreal 250 days. Ten Unreal stars continue in increments of 50 days, reaching 750. Tier claim XP is 25/35/45/60/80/110/130/160/200; stars award no extra XP.

The Rewards Info tab explains these rates and examples, with previous rules in a disclosure. The ledger adds Recovery and PB columns, per-date versions, the change boundary, older-date paging and itemised improvement explanations. All balance changes after claims/saves use the shared engine.

Verification of physical XP uses an allocation of the daily category totals across contributing blocks. Allocations add to the authoritative physical total and cannot repeat completion awards. Verification is a separate source-data indicator; entered weights/reps are not automatically device verified.

## Validation and practical limits

All 1,359 tests passed initially, including dated scoring, base-work partitioning, rounding, weighted pairs, caps, small PBs, exclusions, full PB milestones, helper parity and Rewards UI behaviour. The production build passed. A read-only comparison against the deployed version-3 engine checked all 540 activity dates for Paul, Wilf and Xander, including all daily XP buckets and running balances; every value matched before activation. Raw personal log data remains outside the repository.

This limits advantages from movement names/block partitioning and repeated improvement awards. It does not establish physiological equivalence across sports or detect invented sets, Session completions or configured personal tasks. No inferred warmup classification, mandatory workout timer, arbitrary total-day cap or avatar-affinity XP is introduced. The older experimental 150/100/250 budgets and alternate currencies are not activated.

## Release and rollback

Deploy `group-xp-leaderboard` and `group-seasons-awards` with their complete checked-in bundles and existing JWT enforcement, then merge the reviewed app release to the connected production branch. Verify function versions/files, production Git SHA and deployed bundle markers. No schema migration is needed.

Before activation, a rollback can restore the previous app and backend bundles without touching stored user data. After activation, preserve v4 for already-scored dates; any later rules revision needs a new dated version rather than reinterpreting earned history.
