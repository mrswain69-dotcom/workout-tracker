// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db.js", () => ({ listPlanTemplates: vi.fn() }));
vi.mock("../groups/groupDb.js", () => ({
  listGroupDirectory: vi.fn(),
  listProfileGroups: vi.fn(),
}));
vi.mock("./trainingProgramDb.js", () => ({
  acceptTrainingProgramAssignment: vi.fn(),
  acceptTrainingProgramShare: vi.fn(),
  applyOwnedTrainingProgram: vi.fn(),
  archiveTrainingProgram: vi.fn(),
  assignTrainingProgramToMembers: vi.fn(),
  buildTrainingProgramShareLink: vi.fn(),
  createTrainingProgramShare: vi.fn(),
  declineTrainingProgramAssignment: vi.fn(),
  importLegacyTrainingProgramTemplate: vi.fn(),
  listManagedTrainingProgramAssignments: vi.fn(),
  listOwnedTrainingPrograms: vi.fn(),
  listTrainingProgramAssignments: vi.fn(),
  previewTrainingProgramShare: vi.fn(),
  readTrainingProgramShareToken: vi.fn(() => ""),
  revokeTrainingProgramAssignment: vi.fn(),
  saveTrainingProgram: vi.fn(),
}));

import { listPlanTemplates } from "../db.js";
import * as groupDb from "../groups/groupDb.js";
import TrainingProgramLibrary from "./TrainingProgramLibrary.jsx";
import * as programDb from "./trainingProgramDb.js";

const program = {
  id: "program-1",
  title: "Two-week match preparation",
  description: "Progressive team plan",
  phase_count: 1,
  week_count: 2,
  current_version_no: 4,
};
const blankDays = () => ({ Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] });
const assignedProgram = {
  id: "assignment-incoming",
  program_id: "program-1",
  version_id: "version-4",
  start_date: "2026-10-05",
  completion_mode: "repeat",
  message: "Complete the skills session first",
  program,
  version: {
    version_no: 4,
    content_json: {
      activityTypes: [],
      program: {
        name: "Two-week match preparation",
        startDate: "2026-10-05",
        completionMode: "repeat",
        phases: [{
          id: "phase-1",
          name: "Build",
          weeks: [{
            id: "week-1",
            name: "Week 1",
            blocksByWeekday: {
              ...blankDays(),
              Mon: [{ id: "skills-1", typeId: "session", label: "Team skills" }],
            },
          }],
        }],
      },
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  listPlanTemplates.mockResolvedValue({ data: [], error: null });
  programDb.listOwnedTrainingPrograms.mockResolvedValue({ data: [program], error: null });
  programDb.listTrainingProgramAssignments.mockResolvedValue({ data: [], error: null });
  programDb.listManagedTrainingProgramAssignments.mockResolvedValue({ data: [], error: null });
  groupDb.listProfileGroups.mockResolvedValue({
    data: [{
      id: "group-1",
      name: "Falcons",
      membership: { id: "membership-self", role: "admin" },
    }],
    error: null,
  });
  groupDb.listGroupDirectory.mockResolvedValue({
    data: [
      { membership_id: "membership-self", nickname: "Coach", role: "admin" },
      { membership_id: "membership-one", nickname: "Rocket", role: "member" },
      { membership_id: "membership-two", nickname: "Anchor", role: "member" },
    ],
    error: null,
  });
  programDb.assignTrainingProgramToMembers.mockResolvedValue({ data: 1, error: null });
  programDb.revokeTrainingProgramAssignment.mockResolvedValue({ data: true, error: null });
  programDb.acceptTrainingProgramAssignment.mockResolvedValue({ data: { version: 5 }, error: null });
});

afterEach(() => cleanup());

function renderLibrary(props = {}) {
  return render(
    <TrainingProgramLibrary
      familyId="family-1"
      activeProfileId="profile-1"
      activePlan={{
        activityTypes: [],
        blocksByWeekday: blankDays(),
        program: {
          name: "Active plan",
          startDate: "2026-10-05",
          completionMode: "repeat",
          phases: [{ id: "mine", name: "Mine", weeks: [{ id: "mine-week", name: "Week 1", blocksByWeekday: blankDays() }] }],
        },
      }}
      authorizeMutation={vi.fn(async () => true)}
      {...props}
    />
  );
}

describe("coach/client Program management", () => {
  it("assigns the current frozen version to selected team members", async () => {
    renderLibrary();
    expect(await screen.findByText("Two-week match preparation")).toBeTruthy();
    await waitFor(() => expect(groupDb.listGroupDirectory).toHaveBeenCalledWith("group-1"));

    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    expect(await screen.findByRole("heading", { name: /Assign “Two-week match preparation”/ })).toBeTruthy();
    expect(screen.queryByText("Coach")).toBeNull();
    fireEvent.click(screen.getByText("Rocket"));
    fireEvent.change(screen.getByPlaceholderText("Add context, targets or a welcome note"), {
      target: { value: "Complete this before Sunday" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Assign to 1" }));

    await waitFor(() => expect(programDb.assignTrainingProgramToMembers).toHaveBeenCalledWith({
      programId: "program-1",
      membershipIds: ["membership-one"],
      startDate: expect.any(String),
      completionMode: "repeat",
      recipientCanEdit: true,
      message: "Complete this before Sunday",
    }));
  });

  it("shows outgoing status and only offers revocation while pending", async () => {
    programDb.listManagedTrainingProgramAssignments.mockResolvedValue({
      data: [{
        id: "assignment-1",
        status: "pending",
        start_date: "2026-10-05",
        completion_mode: "repeat",
        message: "Week one first",
        program: { title: "Two-week match preparation" },
        version: { version_no: 4 },
        recipient: { nickname: "Rocket" },
      }],
      error: null,
    });
    renderLibrary();

    expect(await screen.findByText("Awaiting response")).toBeTruthy();
    expect(screen.getByText("for Rocket")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(programDb.revokeTrainingProgramAssignment).toHaveBeenCalledWith("assignment-1"));
  });

  it("previews an assigned week and defaults to adding it alongside the current plan", async () => {
    programDb.listTrainingProgramAssignments.mockResolvedValue({ data: [assignedProgram], error: null });
    const onProgramApplied = vi.fn();
    renderLibrary({ onProgramApplied });

    fireEvent.click(await screen.findByRole("tab", { name: /Shared & assigned/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Preview & choose" }));
    expect(screen.getByRole("heading", { name: /Preview “Two-week match preparation”/ })).toBeTruthy();
    expect(screen.getByText("Team skills")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Add alongside my plan/ }).checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Apply this choice" }));
    await waitFor(() => expect(programDb.acceptTrainingProgramAssignment).toHaveBeenCalledWith(
      "assignment-incoming",
      "profile-1",
      { adoptionMode: "add", preparedPlan: null }
    ));
    expect(onProgramApplied).toHaveBeenCalledWith(
      { version: 5 },
      expect.stringContaining("You can undo this from Build")
    );
  });

  it("prepares a replacement that retains personal task blocks", async () => {
    programDb.listTrainingProgramAssignments.mockResolvedValue({ data: [assignedProgram], error: null });
    const personalTaskPlan = {
      activityTypes: [],
      blocksByWeekday: { ...blankDays(), Mon: [{ id: "physio", typeId: "tasks", tasks: [{ id: "stretch", label: "Stretch" }] }] },
    };
    renderLibrary({ activePlan: personalTaskPlan });

    fireEvent.click(await screen.findByRole("tab", { name: /Shared & assigned/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Preview & choose" }));
    fireEvent.click(screen.getByRole("radio", { name: /Replace, but keep my tasks/ }));
    fireEvent.click(screen.getByRole("button", { name: "Apply this choice" }));

    await waitFor(() => expect(programDb.acceptTrainingProgramAssignment).toHaveBeenCalledWith(
      "assignment-incoming",
      "profile-1",
      expect.objectContaining({
        adoptionMode: "replace_keep_tasks",
        preparedPlan: expect.objectContaining({ program: expect.any(Object) }),
      })
    ));
    const options = programDb.acceptTrainingProgramAssignment.mock.calls[0][2];
    expect(options.preparedPlan.program.phases[0].weeks[0].blocksByWeekday.Mon.map((block) => block.id)).toContain("physio");
  });

  it("limits a profile to one Program alongside its base plan", async () => {
    programDb.listTrainingProgramAssignments.mockResolvedValue({ data: [assignedProgram], error: null });
    renderLibrary({
      activePlan: {
        meta: { programAddOns: [{ id: "existing-assignment", title: "Existing team plan" }] },
        activityTypes: [],
        blocksByWeekday: blankDays(),
      },
    });

    fireEvent.click(await screen.findByRole("tab", { name: /Shared & assigned/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Preview & choose" }));

    expect(screen.getByText(/already have one Program running alongside/)).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Add alongside my plan/ }).disabled).toBe(true);
    expect(screen.getByRole("radio", { name: /Use as my whole plan/ }).checked).toBe(true);
  });
});
