// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssessmentTemplateLibrary from "./AssessmentTemplateLibrary.jsx";

afterEach(cleanup);

function libraryFixture() {
  return {
    templates: [
      {
        id: "assessment-1",
        family_id: "f1",
        name: "Football Monthly Benchmark",
        category: "Football",
        description: "Monthly progress check",
        version: 2,
        sort_order: 1,
        archived: false,
      },
    ],
    tests: [
      {
        id: "test-sprint",
        family_id: "f1",
        name: "10 m acceleration",
        description: "Sprint",
        version: 1,
        metric_type: "time",
        unit: "s",
        scoring_direction: "lower",
        attempt_count: 3,
        result_strategy: "best",
        side_mode: "none",
        allow_negative: false,
        pb_eligible: true,
        metric_config: { decimalPlaces: 2 },
        archived: false,
      },
      {
        id: "test-jump",
        family_id: "f1",
        name: "Standing broad jump",
        version: 1,
        metric_type: "distance",
        unit: "cm",
        scoring_direction: "higher",
        attempt_count: 3,
        result_strategy: "best",
        side_mode: "none",
        allow_negative: false,
        pb_eligible: true,
        metric_config: {},
        archived: false,
      },
    ],
    templateTests: [
      {
        id: "row-1",
        family_id: "f1",
        assessment_template_id: "assessment-1",
        test_id: "test-sprint",
        position: 1,
        section_label: "Athletic",
        display_label: "10 m acceleration",
        instructions: "Sprint flat out",
        protocol_text: "Best of 3",
        config_override: {},
      },
    ],
    developmentTags: [
      { id: "tag-speed", name: "Speed", archived: false },
      { id: "tag-power", name: "Power", archived: false },
    ],
    testDevelopmentTags: [
      { family_id: "f1", test_id: "test-sprint", development_tag_id: "tag-speed" },
    ],
  };
}

function mockDb(data = libraryFixture()) {
  return {
    loadAssessmentLibrary: vi.fn(async () => ({ data, error: null })),
    createTest: vi.fn(async (_familyId, test) => ({ data: { ...test, id: "new-test", family_id: "f1" }, error: null })),
    updateTest: vi.fn(async (id, patch) => ({ data: { id, ...patch }, error: null })),
    archiveTest: vi.fn(async (id) => ({ data: { id, archived: true }, error: null })),
    addTestDevelopmentTag: vi.fn(async (familyId, testId, developmentTagId) => ({ data: { family_id: familyId, test_id: testId, development_tag_id: developmentTagId }, error: null })),
    removeTestDevelopmentTag: vi.fn(async () => ({ error: null })),
    createAssessmentTemplate: vi.fn(async (_familyId, template) => ({ data: { ...template, id: "new-assessment", family_id: "f1" }, error: null })),
    updateAssessmentTemplate: vi.fn(async (id, patch) => ({ data: { id, ...patch }, error: null })),
    archiveAssessmentTemplate: vi.fn(async (id) => ({ data: { id, archived: true }, error: null })),
    createAssessmentTemplateTest: vi.fn(async (_familyId, row) => ({ data: { ...row, id: `new-row-${row.position}` }, error: null })),
    updateAssessmentTemplateTest: vi.fn(async (id, patch) => ({ data: { id, ...patch }, error: null })),
    deleteAssessmentTemplateTest: vi.fn(async () => ({ error: null })),
  };
}

async function renderLibrary(db = mockDb(), props = {}) {
  render(
    <AssessmentTemplateLibrary
      familyId="f1"
      dbApi={db}
      confirmArchive={() => true}
      {...props}
    />
  );
  await screen.findByText("Football Monthly Benchmark");
  return db;
}

describe("AssessmentTemplateLibrary", () => {
  it("loads definition-only library data and shows Assessment cards", async () => {
    const db = await renderLibrary();
    expect(db.loadAssessmentLibrary).toHaveBeenCalledWith("f1");
    expect(screen.getByText("1 Assessment")).toBeTruthy();
    expect(screen.getByText(/v2 · 1 Test/)).toBeTruthy();
    expect(screen.getByText("Athletic")).toBeTruthy();
  });

  it("switches to canonical Tests with metric, tag and usage summaries", async () => {
    await renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Tests" }));
    expect(screen.getByText("2 reusable Tests")).toBeTruthy();
    expect(screen.getByText("Speed")).toBeTruthy();
    expect(screen.getByText(/Used by 1 active Assessment/)).toBeTruthy();
    expect(screen.getByText(/Standing broad jump/)).toBeTruthy();
  });

  it("surfaces library load errors without attempting writes", async () => {
    const db = mockDb();
    db.loadAssessmentLibrary.mockResolvedValue({ data: null, error: new Error("network down") });
    render(<AssessmentTemplateLibrary familyId="f1" dbApi={db} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Could not load Assessment Library: network down");
    expect(db.createTest).not.toHaveBeenCalled();
  });

  it("blocks archiving a canonical Test that is used by an active Assessment", async () => {
    const db = await renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Tests" }));
    const sprintCard = screen.getByText("10 m acceleration").closest("article");
    fireEvent.click(sprintCard.querySelector("button:nth-of-type(2)"));
    expect(screen.getByRole("alert").textContent).toContain("Remove this Test from 1 active Assessment");
    expect(db.archiveTest).not.toHaveBeenCalled();
  });

  it("archives an unused canonical Test after confirmation", async () => {
    const db = await renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Tests" }));
    const jumpCard = screen.getByText("Standing broad jump").closest("article");
    fireEvent.click(jumpCard.querySelector("button:nth-of-type(2)"));
    await waitFor(() => expect(db.archiveTest).toHaveBeenCalledWith("test-jump", true));
  });

  it("creates a new canonical Test and assigns Development Tags", async () => {
    const db = await renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Tests" }));
    fireEvent.click(screen.getByText("+ Test"));
    fireEvent.change(screen.getByLabelText("Test name"), { target: { value: "Pull-ups" } });
    fireEvent.change(screen.getByLabelText("Metric type"), { target: { value: "repetitions" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "reps" } });
    fireEvent.click(screen.getByLabelText("Power"));
    fireEvent.click(screen.getByText("Save Test"));

    await waitFor(() => expect(db.createTest).toHaveBeenCalled());
    expect(db.createTest).toHaveBeenCalledWith("f1", expect.objectContaining({ name: "Pull-ups", metricType: "repetitions", version: 1 }));
    await waitFor(() => expect(db.addTestDevelopmentTag).toHaveBeenCalledWith("f1", "new-test", "tag-power"));
  });

  it("edits a canonical Test and synchronizes changed tag relationships", async () => {
    const db = await renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Tests" }));
    const sprintCard = screen.getByText("10 m acceleration").closest("article");
    fireEvent.click(sprintCard.querySelector("button"));
    fireEvent.change(screen.getByLabelText("Test name"), { target: { value: "10m Sprint" } });
    fireEvent.click(screen.getByLabelText("Speed"));
    fireEvent.click(screen.getByLabelText("Power"));
    fireEvent.click(screen.getByText("Save Test"));

    await waitFor(() => expect(db.updateTest).toHaveBeenCalledWith("test-sprint", expect.objectContaining({ name: "10m Sprint", version: 2 })));
    expect(db.removeTestDevelopmentTag).toHaveBeenCalledWith("test-sprint", "tag-speed");
    expect(db.addTestDevelopmentTag).toHaveBeenCalledWith("f1", "test-sprint", "tag-power");
  });

  it("directs the parent to Tests when no canonical Test exists", async () => {
    const empty = libraryFixture();
    empty.templates = [];
    empty.tests = [];
    empty.templateTests = [];
    const db = mockDb(empty);
    render(<AssessmentTemplateLibrary familyId="f1" dbApi={db} />);
    await screen.findByText(/No Assessment Templates yet/);
    fireEvent.click(screen.getByText("+ Assessment"));
    expect(screen.getByRole("alert").textContent).toContain("Create at least one canonical Test");
    expect(screen.getByText("0 reusable Tests")).toBeTruthy();
  });

  it("creates a new Assessment Template with ordered canonical Test membership", async () => {
    const db = await renderLibrary();
    fireEvent.click(screen.getByText("+ Assessment"));
    fireEvent.change(screen.getByLabelText("Assessment name"), { target: { value: "Athletic Check" } });
    fireEvent.click(screen.getByText("+ Add Test"));
    fireEvent.change(screen.getByLabelText("Test 1 library Test"), { target: { value: "test-jump" } });
    fireEvent.change(screen.getByLabelText("Test 1 section"), { target: { value: "Power" } });
    fireEvent.click(screen.getByText("Save Assessment"));

    await waitFor(() => expect(db.createAssessmentTemplate).toHaveBeenCalledWith("f1", expect.objectContaining({ name: "Athletic Check", version: 1 })));
    expect(db.createAssessmentTemplateTest).toHaveBeenCalledWith("f1", expect.objectContaining({ assessmentTemplateId: "new-assessment", testId: "test-jump", position: 1, sectionLabel: "Power" }));
  });

  it("opens an existing Assessment with its ordered rows for editing", async () => {
    await renderLibrary();
    const card = screen.getByText("Football Monthly Benchmark").closest("article");
    fireEvent.click(card.querySelector("button"));
    expect(screen.getByLabelText("Assessment name").value).toBe("Football Monthly Benchmark");
    expect(screen.getByLabelText("Test 1 library Test").value).toBe("test-sprint");
    expect(screen.getByText("v2")).toBeTruthy();
  });

  it("archives an Assessment Template without deleting its definition", async () => {
    const db = await renderLibrary();
    const card = screen.getByText("Football Monthly Benchmark").closest("article");
    fireEvent.click(card.querySelector("button:nth-of-type(2)"));
    await waitFor(() => expect(db.archiveAssessmentTemplate).toHaveBeenCalledWith("assessment-1", true));
  });
});
