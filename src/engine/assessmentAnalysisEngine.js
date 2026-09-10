import { buildAssessmentTrainingEvidence } from "./assessmentAnalysisEvidenceEngine.js";
import {
  buildBetweenAssessmentTrainingSummary,
  buildObservedTrainingConsistency,
  buildTrainingEvidenceSummary,
} from "./assessmentAnalysisConsistencyEngine.js";
import { buildAssessmentSessionFocus } from "./assessmentAnalysisFocusEngine.js";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function statusLabel(status) {
  const labels = {
    improved: "improved",
    declined: "declined",
    same: "was unchanged",
    unchanged: "was unchanged",
    mixed: "had mixed results",
    unavailable: "does not yet have a compatible comparison",
  };
  return labels[status] || "does not yet have a compatible comparison";
}

function entryDisplay(entry) {
  return cleanText(entry?.displayValue, "—");
}

function testChangeSentence(test) {
  const name = cleanText(test?.testName, "This Test");
  const status = cleanText(test?.status, "unavailable");
  if (status === "unavailable" || test?.comparisonAvailable !== true) {
    return `${name} does not yet have a compatible latest-versus-previous comparison.`;
  }
  const previous = entryDisplay(test?.previous);
  const latest = entryDisplay(test?.latest);
  if (previous !== "—" && latest !== "—") {
    return `${name} ${statusLabel(status)} from ${previous} to ${latest} between the two compatible benchmarks.`;
  }
  return `${name} ${statusLabel(status)} between the two compatible benchmarks.`;
}

function testPbCount(testId, assessmentProgress) {
  return (assessmentProgress?.latestPbEvents || []).filter(
    (event) => cleanText(event?.testId, "") === cleanText(testId, "")
  ).length;
}

export function buildAssessmentTestAnalyses(assessmentTrainingEvidence = null) {
  const progress = assessmentTrainingEvidence?.assessmentProgress || null;
  return (assessmentTrainingEvidence?.tests || []).map((test) => {
    const evidenceSummary = buildTrainingEvidenceSummary(test.training);
    const changeSentence = testChangeSentence(test);
    return {
      testId: test.testId,
      testName: test.testName,
      status: test.status,
      comparisonAvailable: test.comparisonAvailable === true,
      metricChanged: test.metricChanged === true,
      latest: test.latest,
      previous: test.previous,
      baseline: test.baseline,
      pb: test.pb,
      latestPbCount: testPbCount(test.testId, progress),
      percentageImprovement:
        test.percentageRank === null || test.percentageRank === undefined
          ? null
          : Number(test.percentageRank),
      developmentTagIds: test.developmentTagIds || [],
      developmentTagSource: test.developmentTagSource || "none",
      evidenceLevel: evidenceSummary.evidenceLevel,
      training: test.training,
      evidenceSummary: evidenceSummary.sentence,
      taxonomyNote: evidenceSummary.taxonomyNote,
      narrative: `${changeSentence} ${evidenceSummary.sentence}`,
    };
  });
}

export function buildAssessmentAnalysis({
  runs = [],
  results = [],
  logs = [],
  profileId = "",
  sessionLibrary = {},
  assessmentLibrary = {},
} = {}) {
  const evidence = buildAssessmentTrainingEvidence({
    runs,
    results,
    logs,
    profileId,
    sessionLibrary,
    assessmentLibrary,
  });

  const base = {
    state: evidence.state,
    profileId: cleanText(profileId, ""),
    assessmentTemplateId: evidence.assessmentTemplateId || "",
    latestRun: evidence.latestRun || null,
    previousRun: evidence.previousRun || null,
    interval: evidence.interval,
    assessmentProgress: evidence.assessmentProgress,
  };

  if (evidence.state !== "analysis_ready") {
    return {
      ...base,
      summary: {
        completedAssessments: count(evidence.assessmentProgress?.completedAssessmentCount),
        latestPbCount: 0,
        improved: 0,
        declined: 0,
        unchanged: 0,
        mixed: 0,
        unavailable: 0,
      },
      betweenAssessmentTraining: buildBetweenAssessmentTrainingSummary({}),
      observedConsistency: buildObservedTrainingConsistency({}),
      sessionFocus: {
        developmentTagIds: [],
        sessionBalance: [],
        possibleNextFocus: {
          available: false,
          templateId: "",
          displayCode: "",
          name: "",
          reason: "",
          basis: "session_balance_only",
        },
      },
      tests: [],
      causationBoundary:
        "Analysis describes recorded training alongside benchmark change; it does not establish that training caused the result.",
    };
  }

  const betweenAssessmentTraining = buildBetweenAssessmentTrainingSummary({
    logs,
    profileId,
    interval: evidence.interval,
    sessionTemplates: sessionLibrary.templates || [],
  });
  const observedConsistency = buildObservedTrainingConsistency({
    logs,
    profileId,
    interval: evidence.interval,
  });
  const sessionFocus = buildAssessmentSessionFocus({
    latestRun: evidence.latestRun,
    assessmentProgress: evidence.assessmentProgress,
    assessmentLibrary,
    sessionLibrary,
    logs,
    profileId,
    interval: evidence.interval,
  });
  const tests = buildAssessmentTestAnalyses(evidence);
  const progress = evidence.assessmentProgress;

  return {
    ...base,
    summary: {
      completedAssessments: count(progress?.completedAssessmentCount),
      latestPbCount: count(progress?.latestPbCount),
      improved: (progress?.improvedTests || []).length,
      declined: (progress?.decliningTests || []).length,
      unchanged: (progress?.unchangedTests || []).length,
      mixed: (progress?.mixedTests || []).length,
      unavailable: (progress?.unavailableTests || []).length,
    },
    betweenAssessmentTraining,
    observedConsistency,
    sessionFocus,
    tests,
    causationBoundary:
      "Analysis describes recorded training alongside benchmark change; it does not establish that training caused the result.",
  };
}
