// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssessmentHub from "./AssessmentHub.jsx";

const snapshot = {
  schemaVersion: 1,
  template: {
    id: "a1",
    name: "Stored Snapshot Benchmark",
    category: "Football",
    description: "Snapshot copy",
    version: 2,
  },
  tests: [
    {
      position: 1,
      assessmentTemplateTestId: "row-1",
      testId: "test-1",
      sectionLabel: "Athletic",
      displayLabel: "10m Sprint",
      instructions: "Standing start",
      protocolText: "One effort",
      test: { id: "test-1", name: "10 m acceleration", version: 1 },
      metric: {
        metricType: "time",
        unit: "s",
        scoringDirection: "lower",
        attemptCount: 1,
        resultStrategy: "single",
        sideMode: "none",
        allowNegative: false,
        pbEligible: true,
        metricConfig: { decimalPlaces: 2 },
      },
      developmentTagIds: [],
    },
  ],
};

function definitionLibrary() {
  return {
    templates: [
      {
        id: "a1",
        name: "Live Definition Name",
        category: "Football",
        description: "Current editable definition",
        version: 2,
        sort_order: 1,
        archived: false,
      },
    ],
    tests: [
      {
        id: "test-1",
        name: "10 m acceleration",
        version: 1,
        metric_type: "time",
        unit: "s",
        scoring_direction: "lower",
        attempt_count: 1,
        result_strategy: "single",
        side_mode: "none",
        allow_negative: false,
        pb_eligible: true,
        metric_config: { decimalPlaces: 2 },
        archived: false,
      },
    ],
    templateTests: [
      {
        id: "row-1",
        assessment_template_id: "a1",
        test_id: "test-1",
        position: 1,
        section_label: "Athletic",
        display_label: "10m Sprint",
        instructions: "Standing start",
        protocol_text: "One effort",
        config_override: {},
      },
    ],
    developmentTags: [],
    testDevelopmentTags: [],
  };
}

function runRow() {
  return {
    id: "run-1",
    family_id: "f1",
    profile_id: "p1",
    assessment_template_id: "a1",
    date_ymd: "2026-09-09",
    status: "in_progress",
    started_at: "2026-09-09T18:00:00.000Z",
    template_version: 2,
    template_snapshot: snapshot,
    notes: "",
  };
}

function resultRow() {
  return {
    id: "result-1",
    family_id: "f1",
    assessment_run_id: "run-1",
    test_id: "test-1",
    assessment_template_test_id: "row-1",
    position: 1,
    result_data: { overall: { attempts: [2.04] } },
    retained_result: { overall: 2.04 },
    comparable_value: 2.04,
    comparable_dimensions: { overall: 2.04 },
    is_valid: true,
    notes: "",
  };
}

function mockDb({ library = definitionLibrary(), runs = [] } = {}) {
  return {
    loadAssessmentLibrary: vi.fn(async () => ({ data: library, error: null })),
    listAssessmentRuns: vi.fn(async () => ({ data: runs, error: null })),
    createAssessmentRun: vi.fn(async (_familyId, payload) => ({
      data: {
        ...runRow(),
        template_snapshot: payload.templateSnapshot,
        template_version: payload.templateVersion,
        date_ymd: payload.dateYmd,
      },
      error: null,
    })),
    createAssessmentTestResult: vi.fn(async (_familyId, payload) => ({
      data: {
        ...resultRow(),
        result_data: payload.resultData,
        retained_result: payload.retainedResult,
        comparable_value: payload.comparableValue,
        comparable_dimensions: payload.comparableDimensions,
        is_valid: payload.isValid,
      },
      error: null,
    })),
    getAssessmentRun: vi.fn(async () => ({ data: runRow(), error: null })),
    listAssessmentTestResults: vi.fn(async () => ({ data: [resultRow()], error: null })),
    updateAssessmentTestResult: vi.fn(async (_id, patch) => ({
      data: { ...resultRow(), ...patch },
      error: null,
    })),
    updateAssessmentRun: vi.fn(async (_id, patch) => ({
      data: {
        ...runRow(),
        ...patch,
        template_snapshot: snapshot,
        completed_at: patch.completedAt || null,
      },
      error: null,
    })),
  };
}

async function renderHub(db, props = {}) {
  render(
    <AssessmentHub
      familyId="f1"
      profileId="p1"
      athleteName="Wilf"
      todayYmd="2026-09-09"
      dbApi={db}
      confirmCancel={() => true}
      {...props}
    />
  );
  await waitFor(() => expect(db.loadAssessmentLibrary).toHaveBeenCalled());
}

afterEach(cleanup);

describe("AssessmentHub", () => {
  it("shows the deliberate pre-seed empty state without writing history", async () => {
    const db = mockDb({
      library: {
        templates: [],
        tests: [],
        templateTests: [],
        developmentTags: [],
        testDevelopmentTags: [],
      },
    });
    await renderHub(db);
    expect(await screen.findByText(/Stage 7 will seed the shared Football Monthly Benchmark/)).toBeTruthy();
    expect(db.createAssessmentRun).not.toHaveBeenCalled();
    expect(db.createAssessmentTestResult).not.toHaveBeenCalled();
  });

  it("scopes resumable history to the selected profile", async () => {
    const db = mockDb();
    await renderHub(db);
    expect(db.listAssessmentRuns).toHaveBeenCalledWith("f1", {
      profileId: "p1",
      status: "in_progress",
      limit: 50,
    });
  });

  it("starts an Assessment from the live definition and immediately persists its snapshot", async () => {
    const db = mockDb();
    await renderHub(db);
    fireEvent.click(await screen.findByRole("button", { name: "Start" }));

    await waitFor(() => expect(db.createAssessmentRun).toHaveBeenCalledTimes(1));
    expect(db.createAssessmentRun).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({
        profileId: "p1",
        assessmentTemplateId: "a1",
        dateYmd: "2026-09-09",
        status: "in_progress",
        templateSnapshot: expect.objectContaining({
          template: expect.objectContaining({ name: "Live Definition Name" }),
        }),
      })
    );
    expect(db.createAssessmentTestResult).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Live Definition Name")).toBeTruthy();
  });

  it("resumes from the stored snapshot even when the current editable definition has a different name", async () => {
    const db = mockDb({ runs: [runRow()] });
    await renderHub(db);
    expect(await screen.findByText("Stored Snapshot Benchmark")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));

    expect(await screen.findByText("10m Sprint")).toBeTruthy();
    expect(screen.getByText("Stored Snapshot Benchmark")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Live Definition Name" })).toBeNull();
    expect(db.getAssessmentRun).toHaveBeenCalledWith("f1", "run-1");
  });

  it("cancels by status update and never calls a delete path", async () => {
    const db = mockDb({ runs: [runRow()] });
    await renderHub(db);
    fireEvent.click(await screen.findByRole("button", { name: "Resume" }));
    await screen.findByText("10m Sprint");
    fireEvent.click(screen.getByRole("button", { name: "Cancel Assessment" }));

    await waitFor(() =>
      expect(db.updateAssessmentRun).toHaveBeenCalledWith("run-1", {
        status: "cancelled",
      })
    );
    expect(db.deleteAssessmentRun).toBeUndefined();
    expect(db.deleteAssessmentTestResult).toBeUndefined();
  });
});
