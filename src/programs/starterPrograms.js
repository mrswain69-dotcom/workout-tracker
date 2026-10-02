import {
  emptyBlocksByWeekday,
  ensurePlanProgram,
  extractShareablePlanContent,
  normaliseProgramStartDate,
} from "../engine/planCycleEngine.js";

const ACTIVITY_TYPES = [
  { id: "strength", name: "Strength (sets + reps)", kind: "strength", movementsEnabled: true, sets: 3, allowWeight: true },
  { id: "hiit", name: "HIIT (intervals + circuits)", kind: "strength", movementsEnabled: true, sets: 3, allowWeight: true },
  { id: "box", name: "Boxercise (timed rounds)", kind: "time", movementsEnabled: true, sets: 3, fixedSeconds: 60, allowCount: true, countLabel: "hits" },
  { id: "cardio", name: "Cardio (distance, time or target)", kind: "cardio", movementsEnabled: false, fields: { distanceKm: true, durationMin: true, avgSpeed: true } },
  { id: "duration", name: "Duration (mobility, yoga or stretching)", kind: "custom", movementsEnabled: false, fields: { durationMin: true } },
  { id: "recovery", name: "Recovery", kind: "recovery", movementsEnabled: false, fields: { recoveryDone: true, plannedMinutes: true } },
  { id: "session", name: "Session Library workout", kind: "session", movementsEnabled: false },
  { id: "tasks", name: "Tick-box tasks (yes/no)", kind: "task", movementsEnabled: false, fields: { tasks: true } },
];

const NOTES = {
  "Goblet Squat": "Chest tall. Sit between your hips and drive through the whole foot.",
  "Bodyweight Squats": "Knees track over toes. Move smoothly and keep the chest proud.",
  "Reverse Lunges": "Step back softly. Keep the front knee stable and drive through the front foot.",
  "Lunges": "Stay tall. Keep the front knee stable and control the lowering phase.",
  "Step-ups": "Plant the whole foot. Drive up through the working leg without bouncing off the floor.",
  "Split Squat": "Stay in a split stance. Drop straight down and rise under control.",
  "Hip Hinge (RDL)": "Keep a neutral back, soften the knees and push the hips backwards.",
  "Glute Bridge": "Keep heels close, brace the trunk and squeeze the glutes at the top.",
  "Calf Raises": "Use full range and pause briefly at the top.",
  "Push-ups": "Keep a straight line from shoulders to heels and control every rep.",
  "Dumbbell Row": "Hold a flat back and pull the elbow towards the hip.",
  "Shoulder Press": "Brace the trunk and press overhead without leaning backwards.",
  "Pull / Row variation": "Choose a controlled pulling movement and squeeze the shoulder blades.",
  "Plank": "Keep ribs down, squeeze the glutes and breathe steadily.",
  "Side Plank": "Keep the hips high and make a straight line from head to heels.",
  "Hollow Hold": "Press the lower back down and maintain a strong curved position.",
  "Wall Sit": "Keep the back flat against the wall and breathe steadily.",
  "Squat Jumps": "Jump strongly, land quietly and reset before the next rep.",
  "Jump Rope": "Stay light on the feet and turn the rope from the wrists.",
  "Mountain Climbers": "Keep the hips stable while driving the knees forwards.",
  "Burpees": "Use a smooth rhythm and prioritise clean movement over speed.",
};

function movement(programId, weekday, index, name, overrides = {}) {
  return {
    id: `${programId}_${weekday.toLowerCase()}_movement_${index + 1}`,
    name,
    sets: 3,
    reps: "8–12",
    trackWeight: !["Push-ups", "Plank", "Side Plank", "Hollow Hold", "Wall Sit", "Squat Jumps", "Jump Rope", "Mountain Climbers", "Burpees"].includes(name),
    trackDuration: ["Plank", "Side Plank", "Hollow Hold", "Wall Sit", "Jump Rope"].includes(name),
    initialTarget: "",
    coachNote: NOTES[name] || "",
    ...overrides,
  };
}

function strengthBlock(programId, weekday, label, names, { typeId = "strength", restSec = 60 } = {}) {
  return {
    id: `${programId}_${weekday.toLowerCase()}_${typeId}`,
    typeId,
    label,
    note: "",
    restSec,
    movements: names.map((name, index) => movement(programId, weekday, index, name)),
  };
}

function cardioBlock(programId, weekday, label, targetText, cardioType = "run") {
  return {
    id: `${programId}_${weekday.toLowerCase()}_cardio`,
    typeId: "cardio",
    label,
    note: "",
    cardioType,
    cardioTypeOtherLabel: "",
    activityName: "",
    targetText,
    plannedMinutes: "",
  };
}

function durationBlock(programId, weekday, label, plannedMinutes, note = "") {
  return {
    id: `${programId}_${weekday.toLowerCase()}_duration`,
    typeId: "duration",
    label,
    note,
    plannedMinutes,
  };
}

function recoveryBlock(programId, weekday, label = "Recovery") {
  return {
    id: `${programId}_${weekday.toLowerCase()}_recovery`,
    typeId: "recovery",
    label,
    note: "Recover deliberately so the next quality session can stay high quality.",
    recoveryMode: "full",
    plannedMinutes: "",
  };
}

function oneWeekProgram({ id, title, description, purpose, sport = "", difficulty = "all_levels", focus, blocksByWeekday, startDate }) {
  const plan = ensurePlanProgram({
    version: 5,
    activityTypes: ACTIVITY_TYPES,
    program: {
      schemaVersion: 1,
      name: title,
      description,
      startDate: normaliseProgramStartDate(startDate),
      completionMode: "repeat",
      phases: [{
        id: `${id}_phase_1`,
        name: "Weekly foundation",
        focus,
        assessments: [],
        weeks: [{
          id: `${id}_week_1`,
          name: "Week 1",
          focus,
          blocksByWeekday,
        }],
      }],
    },
  }, { startDate, name: title });

  return {
    id,
    title,
    description,
    purpose,
    sport,
    difficulty,
    ageBand: "all_ages",
    tags: ["starter"],
    content: extractShareablePlanContent(plan),
  };
}

export function buildStarterPrograms(startDate = "") {
  const football = emptyBlocksByWeekday();
  football.Mon = [strengthBlock("football_engine", "Mon", "Lower-body strength", ["Goblet Squat", "Push-ups", "Dumbbell Row", "Plank"], { restSec: 75 })];
  football.Tue = [cardioBlock("football_engine", "Tue", "Speed intervals", "5 min easy · 6 × (1 min fast / 1 min easy) · 5 min easy")];
  football.Wed = [strengthBlock("football_engine", "Wed", "Single-leg strength", ["Reverse Lunges", "Shoulder Press", "Hip Hinge (RDL)", "Side Plank"], { restSec: 75 })];
  football.Thu = [strengthBlock("football_engine", "Thu", "Fast conditioning", ["Mountain Climbers", "Burpees", "Jump Rope", "Hollow Hold"], { typeId: "hiit", restSec: 30 })];
  football.Fri = [strengthBlock("football_engine", "Fri", "Strength maintenance", ["Step-ups", "Pull / Row variation", "Split Squat", "Hollow Hold"], { restSec: 75 })];
  football.Sat = [cardioBlock("football_engine", "Sat", "Tempo conditioning", "10 min easy · 10–15 min steady · 5 min easy")];
  football.Sun = [recoveryBlock("football_engine", "Sun")];

  const power = emptyBlocksByWeekday();
  power.Mon = [strengthBlock("legs_power", "Mon", "Strength base", ["Goblet Squat", "Reverse Lunges", "Calf Raises", "Plank"], { restSec: 90 })];
  power.Tue = [durationBlock("legs_power", "Tue", "Easy mobility", 20, "Move gently through hips, hamstrings and ankles.")];
  power.Wed = [strengthBlock("legs_power", "Wed", "Posterior chain", ["Hip Hinge (RDL)", "Step-ups", "Glute Bridge", "Side Plank"], { restSec: 90 })];
  power.Thu = [recoveryBlock("legs_power", "Thu", "Recovery day")];
  power.Fri = [strengthBlock("legs_power", "Fri", "Power and control", ["Split Squat", "Squat Jumps", "Wall Sit", "Hollow Hold"], { restSec: 90 })];
  power.Sat = [cardioBlock("legs_power", "Sat", "Easy hills", "15–20 min · walk up / easy down", "walk")];

  const conditioning = emptyBlocksByWeekday();
  conditioning.Mon = [strengthBlock("conditioning", "Mon", "Full-body conditioning", ["Push-ups", "Bodyweight Squats", "Mountain Climbers", "Plank"], { typeId: "hiit", restSec: 30 })];
  conditioning.Tue = [cardioBlock("conditioning", "Tue", "Short intervals", "5 min easy · 8 × (30 sec fast / 60 sec easy) · 5 min easy")];
  conditioning.Wed = [strengthBlock("conditioning", "Wed", "Strength circuit", ["Lunges", "Shoulder Press", "Dumbbell Row", "Hollow Hold"], { restSec: 45 })];
  conditioning.Thu = [recoveryBlock("conditioning", "Thu", "Light recovery")];
  conditioning.Fri = [strengthBlock("conditioning", "Fri", "Conditioning circuit", ["Goblet Squat", "Burpees", "Jump Rope", "Side Plank"], { typeId: "hiit", restSec: 30 })];
  conditioning.Sat = [cardioBlock("conditioning", "Sat", "Easy steady cardio", "20–40 min at conversational pace", "walk")];

  const recovery = emptyBlocksByWeekday();
  recovery.Mon = [durationBlock("recovery_mobility", "Mon", "Hip and ankle mobility", 15)];
  recovery.Tue = [cardioBlock("recovery_mobility", "Tue", "Easy walk", "20–40 min relaxed", "walk")];
  recovery.Wed = [durationBlock("recovery_mobility", "Wed", "Core and posture", 15)];
  recovery.Thu = [recoveryBlock("recovery_mobility", "Thu", "Full recovery")];
  recovery.Fri = [durationBlock("recovery_mobility", "Fri", "Shoulders and back mobility", 15)];
  recovery.Sat = [cardioBlock("recovery_mobility", "Sat", "Easy enjoyable movement", "20–60 min relaxed", "walk")];
  recovery.Sun = [recoveryBlock("recovery_mobility", "Sun", "Rest and reset")];

  return [
    oneWeekProgram({
      id: "football_engine",
      title: "Football Speed & Engine",
      description: "A repeatable week combining strength, intervals, conditioning and deliberate recovery.",
      purpose: "Football conditioning",
      sport: "Football",
      difficulty: "intermediate",
      focus: "Speed, robustness and match fitness",
      blocksByWeekday: football,
      startDate,
    }),
    oneWeekProgram({
      id: "legs_power",
      title: "Leg Strength + Power",
      description: "Three progressive lower-body sessions supported by mobility, recovery and easy conditioning.",
      purpose: "Strength and power",
      difficulty: "intermediate",
      focus: "Lower-body strength, control and power",
      blocksByWeekday: power,
      startDate,
    }),
    oneWeekProgram({
      id: "conditioning",
      title: "Full-Body Conditioning",
      description: "A balanced repeatable week for general strength, fitness and work capacity.",
      purpose: "General conditioning",
      difficulty: "all_levels",
      focus: "Whole-body fitness and consistency",
      blocksByWeekday: conditioning,
      startDate,
    }),
    oneWeekProgram({
      id: "recovery_mobility",
      title: "Recovery & Mobility",
      description: "A low-load week of mobility, easy movement and deliberate recovery.",
      purpose: "Recovery and mobility",
      difficulty: "all_levels",
      focus: "Restore movement quality and readiness",
      blocksByWeekday: recovery,
      startDate,
    }),
  ];
}
