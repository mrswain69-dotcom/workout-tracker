import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssessmentTemplateEditor from "./AssessmentTemplateEditor.jsx";

afterEach(cleanup);

const tests = [
  { id: "test-a", name: "10 m acceleration" },
  { id: "test-b", name: "Standing broad jump" },
  { id: "test-c", name: "Press-ups", archived: true },
];

function renderEditor(overrides = {}) {
  const onSave = vi.fn();
  const props = {
    value: {
      template: {
        id: "assessment-1",
        name: "Football Monthly Benchmark",
        category: "Football",
        description: "Monthly check-in",
        version: 3,
      },
      templateTests: [
        {
          id: "row-a",
          assessment_template_id: "assessment-1",
          test_id: "test-a",
          position: 1,
          section_label: "Athletic",
          display_label: "10 m acceleration",
          instructions: "Sprint flat out",
          protocol_text: "3 attempts",
        },
        {
          id: "row-b",
          assessment_template_id: "assessment-1",
          test_id: "test-b",
          position: 2,
          section_label: "Athletic",
          display_label: "Standing broad jump",
        },
      ],
    },
    tests,
    onSave,
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<AssessmentTemplateEditor {...props} />);
  return { ...props, onSave };
}

describe("AssessmentTemplateEditor", () => {
  it("renders identity, version and ordered Test rows", () => {
    renderEditor();
    expect(screen.getByLabelText("Assessment name").value).toBe("Football Monthly Benchmark");
    expect(screen.getByText("v3")).toBeTruthy();
    expect(screen.getByLabelText("Test 1 library Test").value).toBe("test-a");
    expect(screen.getByLabelText("Test 2 library Test").value).toBe("test-b");
  });

  it("does not offer archived canonical Tests", () => {
    renderEditor();
    expect(screen.queryByRole("option", { name: "Press-ups" })).toBeNull();
  });

  it("adds a new empty Test row", () => {
    renderEditor();
    fireEvent.click(screen.getByText("+ Add Test"));
    expect(screen.getByLabelText("Test 3 library Test")).toBeTruthy();
  });

  it("reorders Test rows while renumbering positions", () => {
    const { onSave } = renderEditor();
    fireEvent.click(screen.getByLabelText("Move Test 2 up"));
    expect(screen.getByLabelText("Test 1 library Test").value).toBe("test-b");
    fireEvent.click(screen.getByText("Save Assessment"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        templateTests: [
          expect.objectContaining({ id: "row-b", position: 1, testId: "test-b" }),
          expect.objectContaining({ id: "row-a", position: 2, testId: "test-a" }),
        ],
      })
    );
  });

  it("removes a Test row and renumbers remaining rows", () => {
    const { onSave } = renderEditor();
    fireEvent.click(screen.getByLabelText("Remove Test 1"));
    expect(screen.queryByLabelText("Test 2 library Test")).toBeNull();
    expect(screen.getByLabelText("Test 1 library Test").value).toBe("test-b");
    fireEvent.click(screen.getByText("Save Assessment"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        templateTests: [expect.objectContaining({ id: "row-b", position: 1 })],
      })
    );
  });

  it("preserves per-template section, label, instructions and protocol text", () => {
    const { onSave } = renderEditor();
    fireEvent.change(screen.getByLabelText("Test 1 section"), { target: { value: "Speed" } });
    fireEvent.change(screen.getByLabelText("Test 1 display label"), { target: { value: "10m Sprint" } });
    fireEvent.change(screen.getByLabelText("Test 1 instructions"), { target: { value: "Start behind line" } });
    fireEvent.change(screen.getByLabelText("Test 1 protocol"), { target: { value: "Best of 3" } });
    fireEvent.click(screen.getByText("Save Assessment"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        templateTests: expect.arrayContaining([
          expect.objectContaining({
            testId: "test-a",
            sectionLabel: "Speed",
            displayLabel: "10m Sprint",
            instructions: "Start behind line",
            protocolText: "Best of 3",
          }),
        ]),
      })
    );
  });

  it("blocks save when the Assessment name is blank", () => {
    const { onSave } = renderEditor();
    fireEvent.change(screen.getByLabelText("Assessment name"), { target: { value: "" } });
    expect(screen.getByText("Save Assessment").disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("Assessment name is required.");
    fireEvent.click(screen.getByText("Save Assessment"));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("blocks save when a row has no canonical Test selected", () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText("Test 1 library Test"), { target: { value: "" } });
    expect(screen.getByText("Save Assessment").disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("Test 1 must select a library Test.");
  });

  it("shows a clear prerequisite when the canonical Test library is empty", () => {
    renderEditor({
      value: { template: { name: "New" }, templateTests: [] },
      tests: [],
    });
    expect(screen.getByText(/Create at least one canonical Test/)).toBeTruthy();
    expect(screen.getByText("+ Add Test").disabled).toBe(true);
  });
});
