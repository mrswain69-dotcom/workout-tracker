-- Workout Tracker Phase 2 / Stage 7
-- Shared Football Monthly Benchmark for the initial family use case.
-- Data seed only: no schema changes, workout-log rewrites, profile-plan edits,
-- Assessment runs, or Assessment result rows.
--
-- This seed is intentionally guarded as a one-time initial-family seed. It
-- refuses to run if Assessment definitions already exist for the target family.

begin;

do $$
declare
  target_family constant uuid := 'f483eb48-b1cd-4b36-899a-49d69ae8ae8b';
begin
  if not exists (select 1 from public.families where id = target_family) then
    raise exception 'Stage 7 target family does not exist';
  end if;

  if exists (select 1 from public.assessment_templates where family_id = target_family)
     or exists (select 1 from public.tests where family_id = target_family)
     or exists (select 1 from public.assessment_template_tests where family_id = target_family)
     or exists (select 1 from public.test_development_tags where family_id = target_family) then
    raise exception 'Stage 7 Assessment definitions already exist; verify before reseeding';
  end if;
end $$;

-- Add only the generic Development Tags that the Athletic section requires.
insert into public.development_tags (family_id, name, slug, archived)
values
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Strength', 'strength', false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Power', 'power', false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Acceleration', 'acceleration', false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Mobility', 'mobility', false)
on conflict (family_id, slug)
do update set name = excluded.name, archived = false;

insert into public.assessment_templates (
  family_id, name, category, description, version, sort_order, archived
)
values (
  'f483eb48-b1cd-4b36-899a-49d69ae8ae8b',
  'Football Monthly Benchmark',
  'Football',
  'Shared four-week Athletic + Football Technical benchmark. Keep conditions and protocols consistent and compare each athlete primarily with their own previous results and baseline.',
  1,
  0,
  false
);

-- Canonical reusable Tests. True bilateral protocols use one Test with separate
-- left/right dimensions so each side retains its own PB and history.
insert into public.tests (
  family_id,
  name,
  description,
  version,
  metric_type,
  unit,
  scoring_direction,
  attempt_count,
  result_strategy,
  side_mode,
  allow_negative,
  pb_eligible,
  metric_config,
  archived
)
values
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', '10 m acceleration', 'Measures first-step acceleration over a fixed 10 m distance.', 1, 'time', 's', 'lower', 3, 'best', 'none', false, true, '{"decimalPlaces":2,"fixedDecimals":true,"percentageDecimalPlaces":1}'::jsonb, false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Standing broad jump', 'Measures horizontal explosive power from a two-foot standing jump.', 1, 'distance', 'cm', 'higher', 3, 'best', 'none', false, true, '{"decimalPlaces":0,"percentageDecimalPlaces":1}'::jsonb, false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Strict press-ups', 'Counts controlled strict press-ups before the required movement standard breaks.', 1, 'repetitions', 'reps', 'higher', 1, 'single', 'none', false, true, '{"decimalPlaces":0,"percentageDecimalPlaces":1}'::jsonb, false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Pull-ups', 'Counts clean pull-ups under a consistent grip and assistance condition.', 1, 'repetitions', 'reps', 'higher', 1, 'single', 'none', false, true, '{"decimalPlaces":0,"percentageDecimalPlaces":1}'::jsonb, false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Single-leg calf raises', 'Counts controlled single-leg calf raises independently for left and right.', 1, 'repetitions', 'reps', 'higher', 1, 'single', 'separate', false, true, '{"decimalPlaces":0,"percentageDecimalPlaces":1}'::jsonb, false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Toe-touch flexibility', 'Consistent seated forward-reach measure relative to the toe line; short is negative and beyond is positive.', 1, 'distance', 'cm', 'higher', 1, 'single', 'none', true, true, '{"decimalPlaces":1,"percentageDecimalPlaces":1,"percentageImprovement":"never"}'::jsonb, false),

  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Sole rolls', 'Counts clean controlled sole rolls in a fixed 30-second test.', 1, 'repetitions', 'reps', 'higher', 1, 'single', 'none', false, true, '{"decimalPlaces":0,"percentageDecimalPlaces":1}'::jsonb, false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Drag-backs', 'Counts clean drag-back direction changes with controlled possession in 30 seconds.', 1, 'repetitions', 'reps', 'higher', 1, 'single', 'none', false, true, '{"decimalPlaces":0,"percentageDecimalPlaces":1}'::jsonb, false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Scissor + cut', 'Counts clean scissor-and-cut actions with retained possession in 30 seconds.', 1, 'repetitions', 'reps', 'higher', 1, 'single', 'none', false, true, '{"decimalPlaces":0,"percentageDecimalPlaces":1}'::jsonb, false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Side-foot drags', 'Counts controlled lateral side-foot drags in 30 seconds.', 1, 'repetitions', 'reps', 'higher', 1, 'single', 'none', false, true, '{"decimalPlaces":0,"percentageDecimalPlaces":1}'::jsonb, false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Flip-flap out → in', 'Counts clean same-foot out-to-in flip-flaps independently on each side.', 1, 'repetitions', 'reps', 'higher', 1, 'single', 'separate', false, true, '{"decimalPlaces":0,"percentageDecimalPlaces":1}'::jsonb, false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Flip-flap in → out', 'Counts clean same-foot in-to-out flip-flaps independently on each side.', 1, 'repetitions', 'reps', 'higher', 1, 'single', 'separate', false, true, '{"decimalPlaces":0,"percentageDecimalPlaces":1}'::jsonb, false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Stop & go', 'Measures successful controlled stop-and-go actions from a fixed ten-trial protocol.', 1, 'attempts_successes', '', 'higher', 1, 'single', 'none', false, true, '{"decimalPlaces":0,"percentageDecimalPlaces":1,"comparisonMode":"successes","fixedAttempts":10,"showRate":false}'::jsonb, false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Inside-foot receiving', 'Measures successful first-touch control into a repeatable marked area.', 1, 'attempts_successes', '', 'higher', 1, 'single', 'none', false, true, '{"decimalPlaces":0,"percentageDecimalPlaces":1,"comparisonMode":"successes","fixedAttempts":10,"showRate":false}'::jsonb, false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Outside-foot receiving', 'Measures outside-foot first-touch control independently on left and right.', 1, 'attempts_successes', '', 'higher', 1, 'single', 'separate', false, true, '{"decimalPlaces":0,"percentageDecimalPlaces":1,"comparisonMode":"successes","fixedAttempts":5,"showRate":false}'::jsonb, false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Laces cushion', 'Measures successful cushioning of a repeatable bounced or tossed feed into immediate control.', 1, 'attempts_successes', '', 'higher', 1, 'single', 'none', false, true, '{"decimalPlaces":0,"percentageDecimalPlaces":1,"comparisonMode":"successes","fixedAttempts":10,"showRate":false}'::jsonb, false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Protected side-on outside-foot receive', 'Measures side-on receiving away from pressure independently on left and right.', 1, 'attempts_successes', '', 'higher', 1, 'single', 'separate', false, true, '{"decimalPlaces":0,"percentageDecimalPlaces":1,"comparisonMode":"successes","fixedAttempts":5,"showRate":false}'::jsonb, false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'First touch through gate', 'Measures directional first touches through a fixed gate independently on left and right.', 1, 'attempts_successes', '', 'higher', 1, 'single', 'separate', false, true, '{"decimalPlaces":0,"percentageDecimalPlaces":1,"comparisonMode":"successes","fixedAttempts":5,"showRate":false}'::jsonb, false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Weak-foot keepy-uppys', 'Best consecutive clean touch streak using only the weaker foot.', 1, 'repetitions', 'touches', 'higher', 3, 'best', 'none', false, true, '{"decimalPlaces":0,"percentageDecimalPlaces":1}'::jsonb, false),
  ('f483eb48-b1cd-4b36-899a-49d69ae8ae8b', 'Moving keepy-uppys', 'Best consecutive clean touch streak while continuing to travel forward.', 1, 'repetitions', 'touches', 'higher', 3, 'best', 'none', false, true, '{"decimalPlaces":0,"percentageDecimalPlaces":1}'::jsonb, false);

-- Ordered benchmark composition and frozen protocol text used by future runs.
insert into public.assessment_template_tests (
  family_id,
  assessment_template_id,
  test_id,
  position,
  section_label,
  display_label,
  instructions,
  protocol_text
)
select
  'f483eb48-b1cd-4b36-899a-49d69ae8ae8b',
  at.id,
  t.id,
  seed.position,
  seed.section_label,
  seed.display_label,
  seed.instructions,
  seed.protocol_text
from public.assessment_templates at
join (
  values
    (1, 'Athletic', '10 m acceleration', '10 m acceleration', 'Record all three timed attempts.', 'Use the same 10 m distance, surface, shoes, warm-up and still athletic start each month. Complete 2–3 progressive practice accelerations first. Take 3 timed attempts with full 2–3 minute recovery; retain the fastest valid time.'),
    (2, 'Athletic', 'Standing broad jump', 'Standing broad jump', 'Record all three jump distances.', 'Use a flat non-slip surface and fixed start line. Jump forward from two feet, land on two feet and stick the landing. Measure from the start line to the nearest heel. Repeat an invalid landing. Retain the best of 3 valid jumps.'),
    (3, 'Athletic', 'Strict press-ups', 'Strict press-ups', 'Enter the number of clean strict reps.', 'One controlled set. Keep the body line and required chest depth consistent. Stop the scored set when depth or body-line standard clearly fails.'),
    (4, 'Athletic', 'Pull-ups', 'Pull-ups', 'Enter clean reps and note any assistance band used.', 'One clean set with the same grip and assistance condition each month. No swinging, kicking or neck-reaching. Record an assistance band in Test notes. If assistance changes materially, treat that as a new Test level rather than a directly comparable score.'),
    (5, 'Athletic', 'Single-leg calf raises', 'Single-leg calf raises', 'Enter left and right clean reps separately.', 'One set each side using the same step/floor position and range each month. Use balance support only, not push-off assistance. Stop when height/control clearly falls. Cap the scored test at 30 clean reps per side.'),
    (6, 'Athletic', 'Toe-touch flexibility', 'Toe-touch flexibility', 'Enter centimetres short of the toes as negative or beyond the toes as positive.', 'Sit with legs straight together and heels on a fixed line. Reach both hands forward evenly without bouncing. Keep knees straight without forcefully locking them. Use the toe line as zero; for example 4 cm short = -4 and 3 cm beyond = +3.'),

    (7, 'Technical', 'Sole rolls', 'Sole rolls', 'Count clean controlled reps in 30 seconds.', 'Use the same ball and working area each month. One complete controlled roll across the body counts as 1. The ball must remain inside the working area.'),
    (8, 'Technical', 'Drag-backs', 'Drag-backs', 'Count clean controlled reps in 30 seconds.', 'Drag the ball, change direction and regain controlled possession. Alternate feet/directions. One complete controlled action counts as 1.'),
    (9, 'Technical', 'Scissor + cut', 'Scissor + cut', 'Count clean actions in 30 seconds.', 'One clean scissor followed by an effective directional cut with retained possession counts as 1.'),
    (10, 'Technical', 'Side-foot drags', 'Side-foot drags', 'Count clean controlled reps in 30 seconds.', 'One complete controlled lateral drag counts as 1. Alternate direction and keep the ball in the fixed working area.'),
    (11, 'Technical', 'Flip-flap out → in', 'Flip-flap out → in', 'Run a 30-second scored window for each side and enter left/right separately.', 'Both touches must use the same foot and possession must be retained for the action to count. Use the same working area and ball each month.'),
    (12, 'Technical', 'Flip-flap in → out', 'Flip-flap in → out', 'Run a 30-second scored window for each side and enter left/right separately.', 'Use the reverse same-foot action. Both touches must be clean and possession retained for the action to count. Use the same working area and ball each month.'),
    (13, 'Technical', 'Stop & go', 'Stop & go', 'Complete 10 trials and enter successful actions.', 'A success requires the ball to stop under control and the first touch to accelerate clearly away without losing possession. The runner locks this Test to 10 trials.'),
    (14, 'Technical', 'Inside-foot receiving', 'Inside-foot receiving', 'Complete 10 repeatable feeds and enter successes.', 'Use the same wall/feed distance and marked control area each month. A success requires the first touch with the inside of the foot to control the ball into the target area. The runner locks this Test to 10 feeds.'),
    (15, 'Technical', 'Outside-foot receiving', 'Outside-foot receiving', 'Complete 5 repeatable feeds per side and enter left/right successes.', 'Use the same feed distance and target area each month. A success requires the outside-foot first touch to control into the marked area. Stage 7 standardises the source 10-feed R/L protocol as 5 feeds per side for repeatability.'),
    (16, 'Technical', 'Laces cushion', 'Laces cushion', 'Complete 10 repeatable feeds and enter successes.', 'Use a consistent gentle bounced/tossed feed. Cushion with the top/laces so the ball finishes under immediate control. Keep feed height and strength as consistent as practical.'),
    (17, 'Technical', 'Protected side-on outside-foot receive', 'Protected side-on outside-foot receive', 'Complete 5 feeds per side and enter left/right successes.', 'Use a flat marker as the pressure reference. Start/check side-on, put the body between pressure and ball, receive with the outside of the far foot and take the first touch away from pressure. Five feeds per side.'),
    (18, 'Technical', 'First touch through gate', 'First touch through gate', 'Complete 5 feeds per side and enter left/right successes.', 'Keep the gate about 1 m wide, roughly 3–4 m from the feeder and about 45 degrees from the receiving line throughout this block. The first touch must pass cleanly through the gate and remain immediately playable. Five attempts per side.'),
    (19, 'Technical', 'Weak-foot keepy-uppys', 'Weak-foot keepy-uppys', 'Record three scored streaks; the best is retained.', 'Use only the weaker foot during each scored run. Count consecutive legal controlled touches until the ball is lost; no stronger-foot rescue touch. Retain the best of 3.'),
    (20, 'Technical', 'Moving keepy-uppys', 'Moving keepy-uppys', 'Record three scored moving streaks; the best is retained.', 'Keep the ball up while continuing to travel forward through the same lane/space each month. Count controlled touches until the run ends. Retain the best of 3.')
) as seed(position, section_label, test_name, display_label, instructions, protocol_text)
  on true
join public.tests t
  on t.family_id = at.family_id
 and t.name = seed.test_name
where at.family_id = 'f483eb48-b1cd-4b36-899a-49d69ae8ae8b'
  and at.name = 'Football Monthly Benchmark';

-- Tests and training Movements meet only through shared generic Development Tags.
insert into public.test_development_tags (family_id, test_id, development_tag_id)
select
  'f483eb48-b1cd-4b36-899a-49d69ae8ae8b',
  t.id,
  dt.id
from (
  values
    ('10 m acceleration', 'acceleration'),
    ('10 m acceleration', 'power'),
    ('Standing broad jump', 'power'),
    ('Strict press-ups', 'strength'),
    ('Pull-ups', 'strength'),
    ('Single-leg calf raises', 'strength'),
    ('Toe-touch flexibility', 'mobility'),

    ('Sole rolls', 'football'), ('Sole rolls', 'close-control'), ('Sole rolls', 'ball-manipulation'),
    ('Drag-backs', 'football'), ('Drag-backs', 'close-control'), ('Drag-backs', 'ball-manipulation'),
    ('Scissor + cut', 'football'), ('Scissor + cut', 'close-control'), ('Scissor + cut', 'ball-manipulation'),
    ('Side-foot drags', 'football'), ('Side-foot drags', 'close-control'), ('Side-foot drags', 'ball-manipulation'),
    ('Flip-flap out → in', 'football'), ('Flip-flap out → in', 'close-control'), ('Flip-flap out → in', 'ball-manipulation'),
    ('Flip-flap in → out', 'football'), ('Flip-flap in → out', 'close-control'), ('Flip-flap in → out', 'ball-manipulation'),
    ('Stop & go', 'football'), ('Stop & go', 'close-control'), ('Stop & go', 'ball-manipulation'),

    ('Inside-foot receiving', 'football'), ('Inside-foot receiving', 'first-touch'), ('Inside-foot receiving', 'receiving'),
    ('Outside-foot receiving', 'football'), ('Outside-foot receiving', 'first-touch'), ('Outside-foot receiving', 'receiving'),
    ('Laces cushion', 'football'), ('Laces cushion', 'first-touch'), ('Laces cushion', 'receiving'),
    ('Protected side-on outside-foot receive', 'football'), ('Protected side-on outside-foot receive', 'first-touch'), ('Protected side-on outside-foot receive', 'receiving'),
    ('First touch through gate', 'football'), ('First touch through gate', 'first-touch'), ('First touch through gate', 'receiving'),
    ('Weak-foot keepy-uppys', 'football'), ('Weak-foot keepy-uppys', 'ball-manipulation'), ('Weak-foot keepy-uppys', 'weak-foot'),
    ('Moving keepy-uppys', 'football'), ('Moving keepy-uppys', 'ball-manipulation')
) as seed(test_name, tag_slug)
join public.tests t
  on t.family_id = 'f483eb48-b1cd-4b36-899a-49d69ae8ae8b'
 and t.name = seed.test_name
join public.development_tags dt
  on dt.family_id = t.family_id
 and dt.slug = seed.tag_slug;

commit;
