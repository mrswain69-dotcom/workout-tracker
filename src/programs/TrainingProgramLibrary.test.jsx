// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./programWorkflowDb.js", () => ({
  listRecipientProgramControls: vi.fn(async () => ({ data: [], error: null })),
  setProgramReporting: vi.fn(async () => ({ data: true, error: null })),
  setProgramPermissions: vi.fn(async () => ({ data: true, error: null })),
  getProgramCoachReport: vi.fn(async () => ({ data: {}, error: null })),
}));
vi.mock("./coachClientDb.js", () => ({ listCoachClientConnections: vi.fn(async () => ({ data: [], error: null })), assignProgramToClients: vi.fn(), readCoachInvite: vi.fn(() => ""), coachInviteUrl: vi.fn(), previewCoachInvite: vi.fn(), inviteCoachClient: vi.fn(), acceptCoachInvite: vi.fn(), disconnectCoachClient: vi.fn() }));
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
  rescheduleTrainingProgramAssignment: vi.fn(),
  offerTrainingProgramReplacement: vi.fn(),
  saveTrainingProgram: vi.fn(),
}));

import { listPlanTemplates } from "../db.js";
import * as clientDb from "./coachClientDb.js";
import * as groupDb from "../groups/groupDb.js";
import TrainingProgramLibrary from "./TrainingProgramLibrary.jsx";
import * as programDb from "./trainingProgramDb.js";

describe("personal programme management integration", () => {
  it("keeps archived programmes collapsed and separate from assignment choices", async () => {
    programDb.listOwnedTrainingPrograms.mockResolvedValue({ data: [program, { ...program, id: "archived", title: "Old preparation", status: "archived" }], error: null });
    renderLibrary();
    await screen.findByText("Old preparation");
    expect(document.querySelector(".programArchive").open).toBe(false);
    expect(screen.getByText("Archived Programs (1)")).toBeTruthy();
    expect(programDb.listOwnedTrainingPrograms).toHaveBeenCalledWith("family-1", true);
  });
  it("allows cancelling replacement before any active plan is written", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderLibrary();
    await screen.findByText("Two-week match preparation");
    fireEvent.click(screen.getAllByRole("button", { name: "View details" })[0]);
    fireEvent.click(screen.getAllByRole("button").find((button) => button.textContent.includes("Make this my current plan") && !button.textContent.includes("but keep")));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("base training and task blocks will be replaced"));
    expect(programDb.applyOwnedTrainingProgram).not.toHaveBeenCalled();
  });
  it("shows the full saved Program adoption model and greys choices that are not connected yet", async () => {
    renderLibrary();
    await screen.findByText("Two-week match preparation");
    fireEvent.click(screen.getAllByRole("button", { name: "View details" })[0]);
    expect(screen.getByRole("button", { name: /Add alongside my current plan/ }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: /Make this my current plan, but keep my Tasks/ }).disabled).toBe(true);
    expect(screen.getAllByRole("button").find((button) => button.textContent.includes("Make this my current plan") && !button.textContent.includes("but keep")).disabled).toBe(false);
  });
  it("gives Community Programs a distinct discovery workspace", async () => {
    renderLibrary();
    fireEvent.click(await screen.findByRole("tab", { name: "Community" }));
    expect(screen.getByRole("heading", { name: "Find Programs built for real training" })).toBeTruthy();
    expect(screen.getByText("Free first")).toBeTruthy();
    expect(screen.getByText(/No pay-to-win/)).toBeTruthy();
  });
});

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
  clientDb.listCoachClientConnections.mockResolvedValue({ data: [], error: null });
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
  programDb.rescheduleTrainingProgramAssignment.mockResolvedValue({ data: true, error: null });
  programDb.offerTrainingProgramReplacement.mockResolvedValue({ data: "offer-1", error: null });
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
  it("sends follow-as-supplied permissions and optional sharing independently", async () => {
    renderLibrary();
    fireEvent.click(await screen.findByRole("button", { name: "View details" }));
    fireEvent.click(screen.getByRole("button", { name: "Assign programme" }));
    fireEvent.change(screen.getByLabelText("Recipient permissions"), { target: { value: "follow" } });
    fireEvent.click(await screen.findByText("Rocket"));
    fireEvent.click(screen.getByRole("button", { name: "Assign to 1" }));
    await waitFor(() => expect(programDb.assignTrainingProgramToMembers).toHaveBeenCalledWith(expect.objectContaining({ recipientCanEdit: false, recipientCanCopy: false })));
  });
  it("includes the recipient's explicit reporting choices in acceptance", async () => {
    programDb.listTrainingProgramAssignments.mockResolvedValue({ data: [{ ...assignedProgram, recipient_can_edit: false, recipient_can_copy: false }], error: null });
    renderLibrary();
    fireEvent.click(await screen.findByRole("tab", { name: /Shared & assigned/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Preview & choose" }));
    expect(screen.getByText(/Follow as supplied:/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /Share programme adherence/ }));
    fireEvent.click(screen.getByRole("button", { name: "Apply this choice" }));
    await waitFor(() => expect(programDb.acceptTrainingProgramAssignment).toHaveBeenCalledWith(assignedProgram.id, "profile-1", expect.objectContaining({ shareAdherence: true, shareAssessments: false })));
  });

  it("reschedules pending invitations without replacing an athlete plan", async () => {
    programDb.listManagedTrainingProgramAssignments.mockResolvedValue({ data: [{ ...assignedProgram, status: "pending", recipient: { nickname: "Rocket" } }], error: null });
    renderLibrary();
    fireEvent.click(await screen.findByRole("button", { name: "Reschedule" }));
    fireEvent.change(screen.getByLabelText("New start date"), { target: { value: "2026-10-14" } });
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await waitFor(() => expect(programDb.rescheduleTrainingProgramAssignment).toHaveBeenCalledWith(expect.objectContaining({ assignmentId: assignedProgram.id, startDate: "2026-10-12" })));
    expect(programDb.offerTrainingProgramReplacement).not.toHaveBeenCalled();
    expect(programDb.acceptTrainingProgramAssignment).not.toHaveBeenCalled();
  });

  it("offers a latest version for an active assignment, leaving it active until acceptance", async () => {
    programDb.listManagedTrainingProgramAssignments.mockResolvedValue({ data: [{ ...assignedProgram, status: "accepted", active_state: "active", recipient: { nickname: "Rocket" } }], error: null });
    renderLibrary();
    expect(await screen.findByText("Active")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Replace / update" }));
    expect(screen.getByText("The athlete must accept this offer before their current programme changes.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send offer" }));
    await waitFor(() => expect(programDb.offerTrainingProgramReplacement).toHaveBeenCalledWith(expect.objectContaining({ assignmentId: assignedProgram.id, programId: "program-1" })));
    expect(programDb.acceptTrainingProgramAssignment).not.toHaveBeenCalled();
  });

  it("updates an existing add-on without offering to overwrite the personal plan", async () => {
    programDb.listTrainingProgramAssignments.mockResolvedValue({ data: [{ ...assignedProgram, replaces_assignment_id: "old-addon", replacement_adoption_mode: "add" }], error: null });
    renderLibrary({ activePlan: { meta: { programAddOns: [{ id: "old-addon" }] } } });
    fireEvent.click(await screen.findByRole("tab", { name: /Shared & assigned/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Preview & choose" }));
    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(screen.getByRole("radio", { name: /Replace my assigned add-on/ }).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Apply this choice" }));
    await waitFor(() => expect(programDb.acceptTrainingProgramAssignment).toHaveBeenCalledWith(assignedProgram.id, "profile-1", { adoptionMode: "add", preparedPlan: null, shareAdherence: false, shareAssessments: false }));
  });
  it("assigns the current frozen version to selected team members", async () => {
    renderLibrary();
    expect(await screen.findByText("Two-week match preparation")).toBeTruthy();
    await waitFor(() => expect(groupDb.listGroupDirectory).toHaveBeenCalledWith("group-1"));

    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    fireEvent.click(screen.getByRole("button", { name: "Assign programme" }));
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
      recipientCanCopy: true,
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
      { adoptionMode: "add", preparedPlan: null, shareAdherence: false, shareAssessments: false }
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


describe("direct client assignments", () => {
  it("assigns a frozen programme to a consented client without a team", async () => {
    groupDb.listProfileGroups.mockResolvedValue({ data: [], error: null });
    clientDb.listCoachClientConnections.mockResolvedValue({ data: [{ id: "connection-1", coach_family_id: "family-1", client_name: "Alex", status: "active" }], error: null });
    clientDb.assignProgramToClients.mockResolvedValue({ data: 1, error: null });
    renderLibrary();
    await screen.findByText("Two-week match preparation");
    fireEvent.click(screen.getAllByRole("button", { name: "View details" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Assign programme" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Alex Connected client" }));
    fireEvent.change(screen.getByLabelText("Recipient permissions"), { target: { value: "follow" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign to 1" }));
    await waitFor(() => expect(clientDb.assignProgramToClients).toHaveBeenCalledWith(expect.objectContaining({ connectionIds: ["connection-1"], programId: "program-1", recipientCanEdit: false, recipientCanCopy: false })));
    expect(programDb.assignTrainingProgramToMembers).not.toHaveBeenCalled();
    await screen.findByText('Assigned “Two-week match preparation” to 1 client.');
  });
  it("directs a coach without recipients to connections", async () => {
    groupDb.listProfileGroups.mockResolvedValue({ data: [], error: null });
    renderLibrary();
    await screen.findByText("Two-week match preparation");
    fireEvent.click(screen.getAllByRole("button", { name: "View details" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Assign programme" }));
    await screen.findByText("Connect a client here, or administer a team, before assigning a programme.");
    expect(screen.getByRole("heading", { name: "Coaching connections" })).toBeTruthy();
  });
});
