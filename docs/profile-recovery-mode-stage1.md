# Profile Recovery Mode — Stage 1

## Purpose

Add a parent-authorised per-profile Recovery Mode without rewriting the athlete's weekly plan.

Modes: Normal training, Injury Recovery, Illness Recovery.

The source Recovery Day doctrine remains authoritative: recovery is structured performance behaviour, gives fixed completion XP, does not create PR/volume XP, and must not become an XP-farming route.

## Injury Recovery

Weekly physical blocks remain visible but paused. Tasks remain active. A generated **Today’s Physio** Recovery block records one total number of physio minutes for the day, even if work was split across multiple sessions. Any positive duration completes the block for **5 Recovery XP**.

## Illness Recovery

Weekly physical blocks remain visible but paused. Tasks remain active. A generated **Illness recovery** block is completed only when the athlete explicitly confirms that rest/recovery was respected. Completion gives **5 Recovery XP**.

## Reward authority

Profile Recovery Mode does not award physical XP from paused blocks, normal day-complete XP, workout-streak XP, improvement XP or PR XP. Tasks remain independently rewardable.

## Consistency

A completed parent-authorised Recovery Mode day may satisfy a planned Consistency day because the athlete followed the intentionally substituted recovery plan. An incomplete recovery block does not receive Consistency completion.

## History

The profile_recovery_periods table records recovery periods separately from plan_json. Turning mode off immediately restores the normal weekly plan without destroying recovery history.

## Safety boundary

Recovery Mode is an activity-planning state, not a diagnosis or medical recommendation.
