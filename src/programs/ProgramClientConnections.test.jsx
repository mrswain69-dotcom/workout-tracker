// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./coachClientDb.js", () => ({ readCoachInvite: vi.fn((v) => v || ""), previewCoachInvite: vi.fn(), inviteCoachClient: vi.fn(), acceptCoachInvite: vi.fn(), disconnectCoachClient: vi.fn(), coachInviteUrl: vi.fn((token) => `https://example.com/?coachInvite=${token}`) }));
import * as db from "./coachClientDb.js";
import ProgramClientConnections from "./ProgramClientConnections.jsx";
const props = { familyId: "client-family", profileId: "athlete", profileName: "Wilf", connections: [], onChanged: vi.fn(async () => {}), authorize: vi.fn(async () => true) };
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState(null, "", "/"); db.readCoachInvite.mockImplementation((v) => v || ""); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("explicit coaching consent", () => {
  it("previews the coach and requires a separate accept for the selected profile", async () => {
    db.previewCoachInvite.mockResolvedValue({ data: { coach_name: "Coach Sam" }, error: null });
    db.acceptCoachInvite.mockResolvedValue({ data: "connection", error: null });
    render(<ProgramClientConnections {...props} />);
    fireEvent.change(screen.getByLabelText("Coaching invitation link or code"), { target: { value: "token" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview invitation" }));
    await screen.findByText("Connect with Coach Sam");
    expect(db.acceptCoachInvite).not.toHaveBeenCalled();
    expect(screen.getByText(/Your workouts, private notes/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Connect Wilf" }));
    await waitFor(() => expect(db.acceptCoachInvite).toHaveBeenCalledWith("token", "athlete"));
    await screen.findByText("Connected. Your coach can now send programme offers to this profile.");
    expect(props.onChanged).toHaveBeenCalled();
  });
  it("shows expired invitations without an acceptance button", async () => {
    db.previewCoachInvite.mockResolvedValue({ data: null, error: null });
    render(<ProgramClientConnections {...props} />);
    fireEvent.change(screen.getByLabelText("Coaching invitation link or code"), { target: { value: "expired" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview invitation" }));
    await screen.findByText(/This invitation has expired/);
    expect(screen.queryByRole("button", { name: "Connect Wilf" })).toBeNull();
  });
  it("does not accept while profile authorization is denied", async () => {
    db.previewCoachInvite.mockResolvedValue({ data: { coach_name: "Coach Sam" }, error: null });
    render(<ProgramClientConnections {...props} authorize={async () => false} />);
    fireEvent.change(screen.getByLabelText("Coaching invitation link or code"), { target: { value: "token" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview invitation" }));
    fireEvent.click(await screen.findByRole("button", { name: "Connect Wilf" }));
    await waitFor(() => expect(db.previewCoachInvite).toHaveBeenCalled());
    expect(db.acceptCoachInvite).not.toHaveBeenCalled();
  });
  it("describes retained plans and cancels disconnect without a write", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ProgramClientConnections {...props} connections={[{ id: "connection", coach_family_id: "coach-family", client_profile_id: "athlete", coach_name: "Coach Sam", status: "active" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect coach" }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Accepted plans and recorded history stay"));
    expect(db.disconnectCoachClient).not.toHaveBeenCalled();
  });
  it("ignores a stale preview when another invitation is pasted", async () => {
    let finish;
    db.previewCoachInvite.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<ProgramClientConnections {...props} />);
    const input = screen.getByLabelText("Coaching invitation link or code");
    fireEvent.change(input, { target: { value: "old" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview invitation" }));
    fireEvent.change(input, { target: { value: "new" } });
    finish({ data: { coach_name: "Old coach" }, error: null });
    await waitFor(() => expect(screen.getByRole("button", { name: "Preview invitation" }).disabled).toBe(false));
    expect(screen.queryByText("Connect with Old coach")).toBeNull();
  });
  it("opens coach tools and exposes a copyable link after creating an invitation", async () => {
    db.inviteCoachClient.mockResolvedValue({ data: { id: "new" }, error: null });
    const onChanged = vi.fn(async () => {});
    render(<ProgramClientConnections {...props} onChanged={onChanged} />);
    fireEvent.click(screen.getByText("Coach tools · My clients and invitations"));
    fireEvent.click(screen.getByRole("button", { name: "Create client invitation" }));
    await screen.findByText("Invitation created. Copy its link below and share it with your client.");
    expect(db.inviteCoachClient).toHaveBeenCalledWith("athlete", "Wilf", 14);
    expect(document.querySelector("details").open).toBe(true);
    expect(onChanged).toHaveBeenCalled();
  });
});
