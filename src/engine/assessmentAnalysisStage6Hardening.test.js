import { describe, expect, it } from "vitest";
import { buildAssessmentAnalysis } from "./assessmentAnalysisEngine.js";
import { buildAssessmentAnalysisInterval } from "./assessmentAnalysisEvidenceEngine.js";
import { formatAssessmentAnalysisDate } from "./assessmentAnalysisViewModel.js";

function run(id, date) {
  return {
    id,
    profile_id: "profile-wilf",
    assessment_template_id: "football",
    date_ymd: date,
    status: "completed",
    completed_at: `${date}T18:00:00Z`,
    template_snapshot: {
      template: { id: "football", name: "Football Benchmark" },
      tests: [
        {
          testId: "receive-test",
          displayLabel: "Outside-foot receive",
          developmentTagIds: ["first-touch"],
        },
      ],
    },
  };
}

function result(runId, value) {
  return {
    id: `${runId}-receive`,
    assessment_run_id: runId,
    test_id: "receive-test",
    position: 1,
    test_name_snapshot: "Outside-foot receive",
    metric_snapshot: {
      metricType: "numeric",
      unit: "reps",
      scoringDirection: "higher",
      attemptCount: 1,
      resultStrategy: "single",
      sideMode: "none",
      allowNegative: false,
      pbEligible: true,
      metricConfig: { decimalPlaces: 0, percentageDecimalPlaces: 1 },
    },
    retained_result: { overall: value },
    comparable_value: value,
    comparable_dimensions: {},
    is_valid: true,
  };
}

function sessionLog(date, templateId, movementId, count) {
  return {
    id: `log-${date}-${templateId}`,
    profile_id: "profile-wilf",
    date_ymd: date,
    log_json: {
      date_ymd: date,
      blocks: [
        {
          id: `block-${date}-${templateId}`,
          typeId: "session",
          session: {
            schemaVersion: 2,
            templateId,
            displayCode: templateId.toUpperCase(),
            name: templateId === "a" ? "Close Control" : "Receiving",
            completed: true,
            actualDurationSec: 600,
            movements: [
              {
                movementId,
                name: movementId,
                developmentTagIds: ["first-touch"],
                trackingMethod: "repetitions",
                trackingConfig: { unit: "reps" },
                completed: true,
                skipped: false,
                result: { overall: { count } },
              },
            ],
          },
        },
      ],
    },
  };
}

function readyAnalysis() {
  return buildAssessmentAnalysis({
    runs: [run("r1", "2026-08-01"), run("r2", "2026-09-01")],
    results: [result("r1", 5), result("r2", 8)],
    logs: [
      sessionLog("2026-08-05", "a", "receive-a", 20),
      sessionLog("2026-08-12", "a", "receive-a", 25),
      sessionLog("2026-08-20", "b", "receive-b", 15),
    ],
    profileId: "profile-wilf",
    sessionLibrary: {
      templates: [
        { id: "a", display_code: "A", name: "Close Control", sort_order: 1, archived: false },
        { id: "b", display_code: "B", name: "Receiving", sort_order: 2, archived: false },
      ],
      templateMovements: [
        { session_template_id: "a", movement_id: "receive-a" },
        { session_template_id: "b", movement_id: "receive-b" },
      ],
      movementDevelopmentTags: [
        { movement_id: "receive-a", development_tag_id: "first-touch" },
        { movement_id: "receive-b", development_tag_id: "first-touch" },
      ],
    },
    assessmentLibrary: {
      developmentTags: [{ id: "first-touch", name: "First Touch", slug: "first-touch", archived: false }],
      testDevelopmentTags: [{ test_id: "receive-test", development_tag_id: "first-touch" }],
    },
  });
}

describe("Phase 4 Stage 6 Analysis hardening", () => {
  it("rejects impossible calendar dates instead of normalising them", () => {
    expect(buildAssessmentAnalysisInterval("2026-02-31", "2026-03-05")).toMatchObject({
      valid: false,
      startDate: "",
      endDate: "",
      calendarDays: 0,
    });
    expect(formatAssessmentAnalysisDate("2026-02-31")).toBe("");
    expect(formatAssessmentAnalysisDate("2028-02-29")).toBe("29 Feb 2028");
  });

  it("keeps focus language explicitly non-prescriptive when consumed on its own", () => {
    const analysis = readyAnalysis();
    expect(analysis.state).toBe("analysis_ready");
    expect(analysis.sessionFocus.possibleNextFocus.available).toBe(true);
    expect(analysis.focusNarrative).toContain("not a training prescription");
    expect(analysis.causationBoundary).toBe(
      "Analysis describes recorded training alongside benchmark change; it does not establish that training caused the result."
    );
  });

  it("does not emit positive causal or load-prescription language in generated Analysis narratives", () => {
    const analysis = readyAnalysis();
    const generated = [
      analysis.resultNarrative,
      analysis.trainingNarrative,
      analysis.focusNarrative,
      analysis.overallNarrative,
      ...(analysis.tests || []).map((test) => test.narrative),
    ].join(" ");

    const forbidden = [
      /because of your training/i,
      /your training caused/i,
      /training led to/i,
      /training resulted in/i,
      /you should train/i,
      /you need to train/i,
      /must train/i,
      /train more/i,
      /increase your training/i,
      /increase the load/i,
    ];

    for (const pattern of forbidden) {
      expect(generated).not.toMatch(pattern);
    }
  });
});
