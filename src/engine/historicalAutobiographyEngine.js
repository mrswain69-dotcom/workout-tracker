import { buildHistoricalAgeChapters } from "./historicalAgeChapterEngine.js";
import {
  buildCareerSummaryFoundation,
  composeHistoricalMilestones,
} from "./historicalMilestoneEngine.js";

const AWARD_LABELS = Object.freeze({
  monthly_xp: "Monthly XP Winner",
  monthly_consistency: "Monthly Most Consistent",
  monthly_improvement: "Monthly Most Improved",
  season_xp: "Season XP Champion",
  season_consistency: "Season Consistency Champion",
  season_improvement: "Season Improvement Champion",
  season_finisher: "Season Finisher",
});

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function decorateFrozenAward(event) {
  if (event?.sourceType !== "group_award") return event;
  const awardType = cleanText(event?.evidence?.awardType);
  const label = AWARD_LABELS[awardType];
  return label ? { ...event, title: label } : event;
}

function chapterConsistencyState(chapter, consistency, milestones) {
  if (milestones.length) return "ready";
  const firstSupportedDate = cleanText(consistency?.firstSupportedDate);
  if (!firstSupportedDate) return "schedule_unavailable";
  if (chapter?.endDate && chapter.endDate < firstSupportedDate) {
    return "not_historically_supported";
  }
  return "no_milestone";
}

function enrichChapter(chapter, milestoneLayer, knowledgeSourceAvailable) {
  const consistencyMilestones = (chapter?.events || []).filter(
    (event) => event?.sourceType === "consistency"
  );
  const knowledgeMilestones = (chapter?.events || []).filter(
    (event) => event?.sourceType === "knowledge"
  );

  return {
    ...chapter,
    consistency: {
      state: chapterConsistencyState(
        chapter,
        milestoneLayer.consistency,
        consistencyMilestones
      ),
      milestones: consistencyMilestones,
    },
    knowledge: {
      state: !knowledgeSourceAvailable
        ? "not_available_yet"
        : knowledgeMilestones.length
        ? "ready"
        : "empty",
      milestones: knowledgeMilestones,
    },
    awards: (chapter?.events || []).filter(
      (event) => event?.sourceType === "group_award"
    ),
  };
}

export function buildHistoricalAutobiographyFoundation({
  events = [],
  workoutLogs = [],
  assessmentRuns = [],
  assessmentResults = [],
  consistencySnapshots = [],
  knowledgeMilestones = [],
  knowledgeSourceAvailable = false,
  profileId = "",
  birthDate = null,
  referenceDate = "",
} = {}) {
  const decoratedBaseEvents = (Array.isArray(events) ? events : []).map(
    decorateFrozenAward
  );
  const milestoneLayer = composeHistoricalMilestones({
    events: decoratedBaseEvents,
    logs: workoutLogs,
    consistencySnapshots,
    knowledgeMilestones,
    knowledgeSourceAvailable,
    profileId,
    birthDate,
    referenceDate,
  });

  const ageChapters = buildHistoricalAgeChapters({
    events: milestoneLayer.events,
    workoutLogs,
    assessmentRuns,
    assessmentResults,
    profileId,
    birthDate,
  });
  const enrichedChapters = (ageChapters.chapters || []).map((chapter) =>
    enrichChapter(chapter, milestoneLayer, knowledgeSourceAvailable)
  );
  const careerSummary = buildCareerSummaryFoundation({
    events: milestoneLayer.events,
    workoutLogs,
    assessmentRuns,
    assessmentResults,
    profileId,
    birthDate,
  });

  return {
    ...ageChapters,
    chapters: enrichedChapters,
    events: milestoneLayer.events,
    milestones: {
      consistency: milestoneLayer.consistency,
      knowledge: milestoneLayer.knowledge,
    },
    careerSummary,
  };
}
