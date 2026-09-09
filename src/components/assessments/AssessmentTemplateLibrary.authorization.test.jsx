// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssessmentTemplateLibrary from "./AssessmentTemplateLibrary.jsx";

afterEach(cleanup);

function emptyLibrary() {
  return {
    templates: [],
    tests: [],
    templateTests: [],
    developmentTags: [],
    testDevelopmentTags: [],
  };
}

function mockDb() {
  return {
    loadAssessmentLibrary: vi.fn(async () => ({ data: emptyLibrary(), error: null })),
    createTest: vi.fn(async (_familyId, test) => ({
      data: { ...test, id: "new-test", family_id: "f1" },
      error: null,
    })),
    updateTest: vi.fn(),
    archiveTest: vi.fn(),
    addTestDevelopmentTag: vi.fn(),
    removeTestDevelopmentTag: vi.fn(),
    createAssessmentTemplate: vi.fn(),
    updateAssessmentTemplate: vi.fn(),
    archiveAssessmentTemplate: vi.fn(),
    createAssessmentTemplateTest: vi.fn(),
    updateAssessmentTemplateTest: vi.fn(),
    deleteAssessmentTemplateTest: vi.fn(),
  };
}

async function openNewTest(db, authorizeMutation) {
  render(
    <AssessmentTemplateLibrary
      familyId="f1"
      dbApi={db}
      authorizeMutation={authorizeMutation}
    />
  );
  await screen.findByText(/No Assessment Templates yet/);
  fireEvent.click(screen.getByRole("button", { name: "Tests" }));
  fireEvent.click(screen.getByText("+ Test"));
  fireEvent.change(screen.getByLabelText("Test name"), {
    target: { value: "Pull-ups" },
  });
  fireEvent.click(screen.getByText("Save Test"));
}

describe("AssessmentTemplateLibrary parent authorization", () => {
  it("performs zero writes when the parent authorization gate is denied", async () => {
    const db = mockDb();
    const authorizeMutation = vi.fn(async () => false);

    await openNewTest(db, authorizeMutation);

    await waitFor(() => expect(authorizeMutation).toHaveBeenCalledWith("change Assessment Test definitions"));
    expect(db.createTest).not.toHaveBeenCalled();
    expect(db.updateTest).not.toHaveBeenCalled();
    expect(db.addTestDevelopmentTag).not.toHaveBeenCalled();
  });

  it("continues to the controller/DB layer when parent authorization succeeds", async () => {
    const db = mockDb();
    const authorizeMutation = vi.fn(async () => true);

    await openNewTest(db, authorizeMutation);

    await waitFor(() => expect(db.createTest).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({ name: "Pull-ups", version: 1 })
    ));
  });
});
