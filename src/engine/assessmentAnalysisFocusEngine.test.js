import { describe, expect, it } from "vitest";
import {
  buildAssessmentSessionFocus,
  buildPossibleNextFocus,
  buildRelevantActiveSessionTemplates,
  buildRelevantSessionBalance,
  collectAssessmentDevelopmentTagIds,
} from "./assessmentAnalysisFocusEngine.js";

function latestRun(testTags = ["first-touch", "receiving"]) {
  return {
    id: "latest",
    assessment_template_id: "football",
    template_snapshot: {
      tests: [
        { testId: "receive-test", developmentTagIds: testTags },
        { testId: "sprint-test", developmentTagIds: ["acceleration"] },
      ],
    },
  };
}

function library() {
  return {
    templates: [
      { id: "a", display_code: "A", name: "Close Control", sort_order: 1, archived: false },
      { id: "b", display_code: "B", name: "Receiving", sort_order: 2, archived: false },
      { id: "c", display_code: "C", name: "Acceleration", sort_order: 3, archived: false },
      { id: "d", display_code: "D", name: "Unrelated Strength", sort_order: 4, archived: false },
      { id: "old", display_code: "OLD", name: "Archived", sort_order: 5, archived: true },
    ],
    templateMovements: [
      { session_template_id: "a", movement_id: "dribble" },
      { session_template_id: "b", movement_id: "receive" },
      { session_template_id: "c", movement_id: "sprint" },
      { session_template_id: "d", movement_id: "press" },
      { session_template_id: "old", movement_id: "receive" },
    ],
    movementDevelopmentTags: [
      { movement_id: "dribble", development_tag_id: "first-touch" },
      { movement_id: "receive", development_tag_id: "receiving" },
      { movement_id: "sprint", development_tag_id: "acceleration" },
      { movement_id: "press", development_tag_id: "upper-body" },
    ],
  };
}

function sessionLog(date, templateId, code, profileId = "wilf", completed = true) {
  return {
    id: `${profileId}-${date}-${templateId}`,
    profile_id: profileId,
    date_ymd: date,
    log_json: {
      date_ymd: date,
      blocks: [{
        id: `block-${date}-${templateId}`,
        typeId: "session",
        session: {
          templateId,
          displayCode: code,
          name: `Session ${code}`,
          completed,
          movements: [{ movementId: `${templateId}-movement`, completed: true, trackingMethod: "completion" }],
        },
      }],
    },
  };
}

const interval = { valid: true, startDate: "2026-09-02", endDate: "2026-09-30" };

describe("Phase 4 Stage 3 Assessment tag collection", () => {
  it("collects and deduplicates frozen Development Tags from the latest Assessment", () => {
    expect(collectAssessmentDevelopmentTagIds({ latestRun: latestRun() })).toEqual([
      "acceleration",
      "first-touch",
      "receiving",
    ]);
  });

  it("uses current Test taxonomy only when frozen snapshot tags are absent", () => {
    const run = latestRun();
    delete run.template_snapshot.tests[0].developmentTagIds;
    const tags = collectAssessmentDevelopmentTagIds({
      latestRun: run,
      testDevelopmentTags: [
        { test_id: "receive-test", development_tag_id: "current-receiving" },
      ],
    });
    expect(tags).toEqual(["acceleration", "current-receiving"]);
  });
});

describe("Phase 4 Stage 3 relevant active Session templates", () => {
  it("includes only active templates whose Movements overlap Assessment tags", () => {
    const rows = buildRelevantActiveSessionTemplates({
      sessionLibrary: library(),
      developmentTagIds: ["first-touch", "receiving", "acceleration"],
    });
    expect(rows.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  it("excludes archived and unrelated templates from recommendation candidates", () => {
    const rows = buildRelevantActiveSessionTemplates({
      sessionLibrary: library(),
      developmentTagIds: ["receiving"],
    });
    expect(rows.map((row) => row.id)).toEqual(["b"]);
  });
});

describe("Phase 4 Stage 3 relevant Session balance", () => {
  it("retains zero-count related active Sessions and marks genuine imbalance", () => {
    const rows = buildRelevantSessionBalance({
      logs: [
        sessionLog("2026-09-05", "a", "A"),
        sessionLog("2026-09-12", "a", "A"),
        sessionLog("2026-09-19", "b", "B"),
      ],
      profileId: "wilf",
      interval,
      sessionLibrary: library(),
      developmentTagIds: ["first-touch", "receiving", "acceleration"],
    });
    expect(rows.map(({ displayCode, completedCount }) => [displayCode, completedCount])).toEqual([
      ["A", 2],
      ["B", 1],
      ["C", 0],
    ]);
    expect(rows.find((row) => row.displayCode === "C")?.underrepresented).toBe(true);
    expect(rows.find((row) => row.displayCode === "C")?.lowestCount).toBe(true);
  });

  it("does not count partial Sessions or another athlete", () => {
    const rows = buildRelevantSessionBalance({
      logs: [
        sessionLog("2026-09-05", "a", "A", "wilf", false),
        sessionLog("2026-09-12", "a", "A", "xander", true),
      ],
      profileId: "wilf",
      interval,
      sessionLibrary: library(),
      developmentTagIds: ["first-touch"],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].completedCount).toBe(0);
    expect(rows[0].underrepresented).toBe(false);
  });

  it("does not manufacture underrepresentation when all relevant Sessions are balanced", () => {
    const rows = buildRelevantSessionBalance({
      logs: [
        sessionLog("2026-09-05", "a", "A"),
        sessionLog("2026-09-12", "b", "B"),
        sessionLog("2026-09-19", "c", "C"),
      ],
      profileId: "wilf",
      interval,
      sessionLibrary: library(),
      developmentTagIds: ["first-touch", "receiving", "acceleration"],
    });
    expect(rows.every((row) => row.underrepresented === false)).toBe(true);
  });
});

describe("Phase 4 Stage 3 possible next focus", () => {
  it("selects the lowest-count relevant Session using stable Session order", () => {
    const focus = buildPossibleNextFocus([
      { templateId: "b", displayCode: "B", name: "Receiving", sortOrder: 2, completedCount: 0, underrepresented: true, lowestCount: true },
      { templateId: "a", displayCode: "A", name: "Close Control", sortOrder: 1, completedCount: 0, underrepresented: true, lowestCount: true },
      { templateId: "c", displayCode: "C", name: "Acceleration", sortOrder: 3, completedCount: 2, underrepresented: false, lowestCount: false },
    ]);
    expect(focus.available).toBe(true);
    expect(focus.templateId).toBe("a");
    expect(focus.basis).toBe("session_balance_only");
    expect(focus.reason).toContain("completed less often than at least one other related active Session");
    expect(focus.reason.toLowerCase()).not.toContain("should");
    expect(focus.reason.toLowerCase()).not.toContain("because");
  });

  it("returns no focus for balanced or insufficient evidence", () => {
    expect(buildPossibleNextFocus([
      { templateId: "a", completedCount: 1, underrepresented: false, lowestCount: false },
      { templateId: "b", completedCount: 1, underrepresented: false, lowestCount: false },
    ]).available).toBe(false);
    expect(buildPossibleNextFocus([]).available).toBe(false);
  });

  it("combines Assessment tags, relevant Session balance and focus without coaching load advice", () => {
    const result = buildAssessmentSessionFocus({
      latestRun: latestRun(),
      sessionLibrary: library(),
      logs: [
        sessionLog("2026-09-05", "a", "A"),
        sessionLog("2026-09-12", "a", "A"),
        sessionLog("2026-09-19", "b", "B"),
      ],
      profileId: "wilf",
      interval,
    });
    expect(result.developmentTagIds).toEqual(["acceleration", "first-touch", "receiving"]);
    expect(result.sessionBalance).toHaveLength(3);
    expect(result.possibleNextFocus.displayCode).toBe("C");
    expect(result.possibleNextFocus.reason).not.toMatch(/increase|more reps|train harder|weight|sprint volume/i);
  });
});
