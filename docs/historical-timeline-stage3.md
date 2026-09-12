# Historical Timeline / Performance Autobiography — Stage 3: Age Chapters, Trends & Improvement Highlights

## Purpose

Stage 3 turns the typed Stage 2 history into truthful age-based chapters and long-range trend evidence without introducing a new scoring system.

The phase now has a deterministic answer to:

- which age chapter did this evidence belong to?;
- what strength/cardio evidence is genuinely comparable?;
- what is merely recorded history but not safely comparable?;
- which performance changes are genuine record improvements?;
- what evidence is unavailable rather than zero?

## Canonical engines reused

Stage 3 deliberately reuses existing Workout Tracker authority:

- `groupImprovementEngine.buildImprovementObservations()` for comparable training/cardio observations;
- `assessmentHistoryEngine.buildAssessmentTestHistory()` for Test history and PB semantics;
- `assessmentHistoryEngine.compareAssessmentHistoryEntries()` for Assessment change semantics;
- `historicalAgeEngine` for attained age and age boundaries;
- Stage 2 typed events for frozen historical evidence.

There is no competing improvement formula.

## Exact age chapter ranges

`historicalAgeEngine.ageChapterDateRange()` now returns true birthday-to-birthday chapter windows.

Example for a 15 December birthday:

- Age 11 = `2025-12-15` → `2026-12-14`;
- Age 12 starts `2026-12-15`.

The Stage 1 leap-day convention remains deterministic: a 29 February birthday advances age on 1 March in non-leap years.

If `birth_date` is missing or invalid, the model returns:

- `available: false`;
- `reason: birth_date_required`;
- zero fabricated age chapters;
- genuine date-based events remain available as `unassignedEvents`;
- trend evidence can still exist without claiming an age.

## Strength evidence

Strength is represented as separate comparable series, never one universal strength score.

For current block-format training, Stage 3 inherits the Group Improvement engine's metric identity:

- weighted movement sets use the canonical `weighted_set_work` observation (`load × reps` for the best observed set);
- otherwise repetition movements use canonical best-set repetitions.

Each movement/metric remains its own series.

Historical legacy strength entries are still visible as recorded evidence from Stage 2, but because the old format does not always preserve enough frozen comparison context they are labelled `recorded_only` when no canonical comparable series exists.

That distinction is intentional:

- `ready` = comparable trend evidence exists;
- `recorded_only` = genuine history exists but trend comparison is not defensible;
- `empty` = no evidence.

## Cardio evidence

Cardio series also reuse Group Improvement's existing compatibility key:

- sport/activity type;
- half-kilometre distance bucket;
- average speed.

This means a 5 km run is not silently compared with a materially different distance/activity simply because both are cardio.

No distance + minutes + speed composite score is created.

## Improvement highlights

Workout/cardio improvement highlights are generated only from the canonical percentage-compatible observation stream.

A highlight requires:

1. previous comparable evidence for exactly the same metric key;
2. a new value that beats the previous best in the metric's correct direction;
3. a percentage calculation that the source engine already permits.

The timeline reports the actual direction-aware recorded percentage change from the previous best. It does not use the Group competition cap because autobiography presentation is not a leaderboard score.

No XP, badge, Challenge or leaderboard value is granted by a timeline highlight.

## Assessment highlights

Assessment histories remain governed by Assessment Metric/History engines.

Where percentage improvement is valid, Assessment observations can participate in the canonical trend stream.

Where an Assessment metric deliberately forbids percentage improvement, Stage 3 can still preserve a genuine PB as an absolute PB highlight using Assessment History record markers. It does **not** manufacture a percentage.

Production currently has zero completed Assessments, so this remains a tested future-ready path rather than fabricated production history.

## Chapter content

Each age chapter contains:

- exact age and birthday-derived start/end dates;
- first/last recorded evidence date inside that age;
- event count;
- unique recorded training days;
- recorded recovery days;
- structured Session count;
- strength evidence state + series;
- cardio evidence state + series;
- Assessment history state;
- improvement/PB highlights;
- own frozen Group awards already present in typed history;
- Knowledge state explicitly `not_available_yet`.

A chapter is not forced to have every category.

## Profile isolation

Stage 3 scopes raw workout logs and Assessment runs/results to the selected `profileId` before building trends.

Permanent tests prove another athlete's raw performance cannot enter the selected athlete's chapter even if mixed rows are supplied to the engine.

## Permanent Stage 3 tests

The new suite proves:

- exact birthday-to-birthday chapter boundaries;
- deterministic leap-day chapter boundaries;
- missing DOB fails closed without hiding genuine date history;
- evidence is partitioned on the real birthday;
- strength/cardio trends reuse canonical observation semantics;
- genuine record improvements are highlighted with correct percentages;
- legacy history is distinguished from comparable trend history;
- cross-profile raw performance is excluded;
- Knowledge remains unavailable until a real historical source exists.

## Next stage

Stage 4 composes the long-range milestone layer:

- historically supportable Consistency evidence;
- frozen Group/season milestones;
- future Knowledge adapter boundary;
- Career Summary foundation;
- the roadmap's explicit **3+ year** Career Summary gate.
