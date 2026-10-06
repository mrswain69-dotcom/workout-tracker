// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./programManagementDb.js", async (original) => ({
  ...await original(), listProgramHistory: vi.fn(), listProgramLinks: vi.fn(),
  updateProgramDetails: vi.fn(), updateProgramLink: vi.fn(), copyProgramVersion: vi.fn(),
}));
vi.mock("./trainingProgramDb.js", () => ({
  buildTrainingProgramShareLink: (token) => "https://example.test/?program=" + token,
  createTrainingProgramShare: vi.fn(),
}));
import ProgramManager from "./ProgramManager.jsx";
import * as db from "./programManagementDb.js";
const days = { Mon: [{ id: "skills", typeId: "session", label: "Ball control" }], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] };
const content = { activityTypes: [], program: { schemaVersion: 1, name: "Preparation", startDate: "2026-10-05", completionMode: "repeat", phases: [{ id: "phase", name: "Skills", weeks: [{ id: "week", name: "Week 1", blocksByWeekday: days }], assessments: [] }] } };
const program = { id: "p1", title: "Preparation", updated_at: "2026-10-06", status: "active", current_version_id: "v2", current_version_no: 2 };
const versions = [{ id: "v2", version_no: 2, content_json: content, change_note: "Added skills", created_at: "2026-10-06" }, { id: "v1", version_no: 1, content_json: content, change_note: "Original", created_at: "2026-10-01" }];
const changed = vi.fn(async () => {});
beforeEach(() => {
  vi.clearAllMocks();
  db.listProgramHistory.mockResolvedValue({ data: versions });
  db.listProgramLinks.mockResolvedValue({ data: [] });
  db.updateProgramDetails.mockResolvedValue({ data: true });
  db.copyProgramVersion.mockResolvedValue({ data: { program_id: "p1", version_no: 3 } });
  db.updateProgramLink.mockResolvedValue({ data: true });
});
afterEach(cleanup);
const show = (authorize = async () => true) => render(<ProgramManager program={program} authorize={authorize} onChanged={changed} onClose={() => {}} />);

describe("saved programme management", () => {
  it("edits metadata with deduplicated tags without creating a content version", async () => {
    show();
    expect(db.listProgramHistory).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New name" } });
    fireEvent.change(screen.getByLabelText("Tags"), { target: { value: " skills, rugby, skills " } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    await waitFor(() => expect(db.updateProgramDetails).toHaveBeenCalledWith(program, expect.objectContaining({ title: "New name", tags: ["skills", "rugby"] })));
    expect(db.copyProgramVersion).not.toHaveBeenCalled();
    await screen.findByText(/Programme details saved/);
  });
  it("previews saved weeks and restores a chosen old version with a change note", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Version history" }));
    await screen.findByText("Original");
    fireEvent.click(screen.getAllByRole("button", { name: "Preview" })[1]);
    expect(screen.getByText("Ball control")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Restore as new version" })[1]);
    fireEvent.change(screen.getByLabelText("Change note"), { target: { value: "Return to previous schedule" } });
    fireEvent.click(screen.getByRole("button", { name: "Create restored version" }));
    await waitFor(() => expect(db.copyProgramVersion).toHaveBeenCalledWith({ program, versionId: "v1", duplicate: false, title: "Preparation", changeNote: "Return to previous schedule" }));
  });
  it("duplicates a frozen version into a separately named programme", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Version history" }));
    await screen.findByText("Original");
    fireEvent.click(screen.getAllByRole("button", { name: "Duplicate" })[1]);
    fireEvent.change(screen.getByLabelText("New programme name"), { target: { value: "Adapted preparation" } });
    fireEvent.click(screen.getByRole("button", { name: "Create duplicate" }));
    await waitFor(() => expect(db.copyProgramVersion).toHaveBeenCalledWith(expect.objectContaining({ versionId: "v1", duplicate: true, title: "Adapted preparation" })));
  });
  it("shows failure feedback and leaves the form available for retry", async () => {
    db.updateProgramDetails.mockResolvedValue({ error: new Error("Programme changed elsewhere") });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    await screen.findByText("Programme changed elsewhere");
    expect(screen.getByRole("button", { name: "Save details" }).disabled).toBe(false);
    expect(changed).not.toHaveBeenCalled();
  });
  it("respects profile mutation authorization", async () => {
    show(async () => false);
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save details" }).disabled).toBe(false));
    expect(db.updateProgramDetails).not.toHaveBeenCalled();
  });
  it("changes expiry and permanently revokes links with confirmation", async () => {
    const link = { id: "link1", share_token: "token", permission: "copy", expires_at: "2099-10-06", version_id: "v2" };
    db.listProgramLinks.mockResolvedValue({ data: [link] });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    show();
    fireEvent.click(screen.getByRole("button", { name: "Sharing links" }));
    await screen.findByText(/Active · Use and adapt/);
    fireEvent.change(screen.getByLabelText("Valid for (days)"), { target: { value: "14" } });
    fireEvent.click(screen.getByRole("button", { name: "Set expiry" }));
    await waitFor(() => expect(db.updateProgramLink).toHaveBeenCalledWith("link1", false, "14"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Revoke" }).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(db.updateProgramLink).toHaveBeenCalledWith("link1", true));
  });
});
