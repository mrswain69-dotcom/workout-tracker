// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./groupDb", () => ({
  createGroup: vi.fn(),
  createGroupInvite: vi.fn(),
  getGroupJoinSettings: vi.fn(),
  joinGroupWithCode: vi.fn(),
  leaveGroup: vi.fn(),
  listGroupDirectory: vi.fn(),
  listGroupInvites: vi.fn(),
  listGroupJoinRequests: vi.fn(),
  listProfileGroups: vi.fn(),
  previewGroupJoinCode: vi.fn(),
  removeGroupMember: vi.fn(),
  reviewGroupJoinRequest: vi.fn(),
  revokeGroupInvite: vi.fn(),
  rotateGroupJoinCode: vi.fn(),
  setGroupJoinMode: vi.fn(),
  setGroupMemberRole: vi.fn(),
  updateGroupDetails: vi.fn(),
  updateGroupNickname: vi.fn(),
  loadGroupXpLeaderboard: vi.fn(),
  loadGroupConsistencyLeaderboard: vi.fn(),
  loadGroupImprovementLeaderboard: vi.fn(),
  updateGroupXpHistoryScope: vi.fn(),
}));

vi.mock("./GroupSeasons.jsx", () => ({ default: () => null }));
vi.mock("./GroupTeamView.jsx", () => ({ default: () => null }));
vi.mock("./GroupChallenges.jsx", () => ({ default: () => null }));

import GroupHub from "./GroupHub.jsx";
import * as groupDb from "./groupDb";

const profiles = [{ id: "profile-1", name: "Wilf" }];

function group(overrides = {}) {
  return {
    id: "group-1",
    name: "Falcons Performance",
    description: "Private squad",
    group_type: "squad",
    status: "active",
    max_members: 50,
    join_mode: "approval",
    membership: {
      id: "membership-self",
      group_id: "group-1",
      role: "admin",
      nickname: "WS10",
      avatar_id: "emoji_bolt",
      avatar_frame: "prestige_cyan_gold",
      avatar_frames_enabled: true,
      joined_at: "2026-09-10T12:00:00Z",
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(async () => undefined) },
  });
  groupDb.listProfileGroups.mockResolvedValue({ data: [], error: null });
  groupDb.listGroupDirectory.mockResolvedValue({ data: [], error: null });
  groupDb.listGroupInvites.mockResolvedValue({ data: [], error: null });
  groupDb.listGroupJoinRequests.mockResolvedValue({ data: [], error: null });
  groupDb.getGroupJoinSettings.mockResolvedValue({
    data: { group_id: "group-1", join_mode: "approval", join_code: "ABCD-EF12-3456-7890", max_members: 50, active_members: 1, pending_requests: 0 },
    error: null,
  });
  groupDb.loadGroupXpLeaderboard.mockResolvedValue({ data: { scoreVersion: 1, scopeMode: "group_start", competitionStartDate: "2026-09-10", current: { startDate: "2026-09-07", endDate: "2026-09-13", state: "live", available: true, rows: [] }, history: [] }, error: null });
  groupDb.loadGroupConsistencyLeaderboard.mockResolvedValue({ data: { scoreVersion: 1, competitionStartDate: "2026-09-10", current: { startDate: "2026-09-07", endDate: "2026-09-13", state: "live", available: true, rows: [] }, history: [] }, error: null });
  groupDb.loadGroupImprovementLeaderboard.mockResolvedValue({ data: { scoreVersion: 1, baselineDays: 28, competitionStartDate: "2026-09-10", current: { startDate: "2026-09-07", endDate: "2026-09-13", state: "live", available: true, rows: [] }, history: [] }, error: null });
  groupDb.updateGroupXpHistoryScope.mockResolvedValue({ data: { xp_history_scope: "group_start" }, error: null });
});

afterEach(() => cleanup());

describe("Group Hub scalable onboarding", () => {
  it("renders empty Create and Join paths", async () => {
    render(<GroupHub profiles={profiles} activeProfileId="profile-1" onClose={vi.fn()} />);
    expect(await screen.findByText(/No Groups yet/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Join" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
  });

  it("creates a Group with an independent Group nickname", async () => {
    groupDb.createGroup.mockResolvedValue({ data: { group_id: "new-group", membership_id: "new-membership" }, error: null });
    groupDb.listProfileGroups.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: [group({ id: "new-group", name: "New Squad" })], error: null });
    render(<GroupHub profiles={profiles} activeProfileId="profile-1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Falcons Performance Squad"), { target: { value: "New Squad" } });
    fireEvent.change(screen.getByPlaceholderText("Shown to this Group"), { target: { value: "Rocket 10" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Group" }));
    await waitFor(() => expect(groupDb.createGroup).toHaveBeenCalledWith(expect.objectContaining({ profileId: "profile-1", name: "New Squad", nickname: "Rocket 10" })));
  });

  it("previews a reusable Group code and submits an approval request", async () => {
    groupDb.previewGroupJoinCode.mockResolvedValue({ data: { code_kind: "shared", group_id: "g2", group_name: "Sprint Crew", group_type: "private", join_mode: "approval", active_members: 12, max_members: 50 }, error: null });
    groupDb.joinGroupWithCode.mockResolvedValue({ data: { group_id: "g2", request_id: "r2", join_status: "pending", code_kind: "shared" }, error: null });
    render(<GroupHub profiles={profiles} activeProfileId="profile-1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    fireEvent.change(screen.getByPlaceholderText("Enter Group code"), { target: { value: "ABCD-EF12-3456-7890" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Group" }));
    expect(await screen.findByText("Sprint Crew")).toBeTruthy();
    expect(screen.getByText("Approval required")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Your nickname in this Group"), { target: { value: "The Rocket" } });
    fireEvent.click(screen.getByRole("button", { name: "Request to join" }));
    await waitFor(() => expect(groupDb.joinGroupWithCode).toHaveBeenCalledWith({ profileId: "profile-1", joinCode: "ABCD-EF12-3456-7890", nickname: "The Rocket" }));
    expect(await screen.findByText(/Admin needs to approve/)).toBeTruthy();
  });

  it("opens a shared join link directly into the Join flow", async () => {
    window.history.replaceState({}, "", "/?groupJoin=ABCD-EF12-3456-7890");
    groupDb.previewGroupJoinCode.mockResolvedValue({ data: { code_kind: "shared", group_id: "g2", group_name: "Falcons", group_type: "squad", join_mode: "approval", active_members: 14, max_members: 50 }, error: null });
    render(<GroupHub profiles={profiles} activeProfileId="profile-1" onClose={vi.fn()} />);
    expect(await screen.findByText("Falcons")).toBeTruthy();
    expect(groupDb.previewGroupJoinCode).toHaveBeenCalledWith("ABCD-EF12-3456-7890");
    expect(window.location.search).not.toContain("groupJoin");
  });

  it("shows one reusable code and safe pending approvals to an Admin", async () => {
    groupDb.listProfileGroups.mockResolvedValue({ data: [group()], error: null });
    groupDb.listGroupDirectory.mockResolvedValue({ data: [
      { membership_id: "membership-self", group_id: "group-1", nickname: "WS10", role: "admin", avatar_id: "emoji_bolt", avatar_frame: "prestige_cyan_gold", avatar_frames_enabled: true, joined_at: "2026-09-10T12:00:00Z" },
      { membership_id: "membership-other", group_id: "group-1", nickname: "Shadow", role: "member", avatar_id: "emoji_tiger", avatar_frame: "", avatar_frames_enabled: true, joined_at: "2026-09-10T12:05:00Z" },
    ], error: null });
    groupDb.listGroupJoinRequests.mockResolvedValue({ data: [{ request_id: "request-1", nickname: "New Player", avatar_id: "emoji_bolt", avatar_frame: "", avatar_frames_enabled: true, requested_at: "2026-09-15T18:00:00Z" }], error: null });
    render(<GroupHub profiles={profiles} activeProfileId="profile-1" onClose={vi.fn()} />);
    expect(await screen.findByText("ABCD-EF12-3456-7890")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy invite link" })).toBeTruthy();
    expect(await screen.findByText("New Player")).toBeTruthy();
    expect(screen.queryByText("profile_id")).toBeNull();
  });

  it("keeps member operations behind a Manage disclosure", async () => {
    groupDb.listProfileGroups.mockResolvedValue({ data: [group()], error: null });
    groupDb.listGroupDirectory.mockResolvedValue({ data: [
      { membership_id: "membership-self", nickname: "WS10", role: "admin", avatar_id: "emoji_bolt", avatar_frame: "", avatar_frames_enabled: true },
      { membership_id: "membership-other", nickname: "Shadow", role: "member", avatar_id: "emoji_tiger", avatar_frame: "", avatar_frames_enabled: true },
    ], error: null });
    render(<GroupHub profiles={profiles} activeProfileId="profile-1" onClose={vi.fn()} />);
    expect(await screen.findByText("Shadow")).toBeTruthy();
    expect(screen.getByText("Manage")).toBeTruthy();
  });

  it("keeps every one-use invite generated in this Groups window copyable and revokable", async () => {
    groupDb.listProfileGroups.mockResolvedValue({ data: [group()], error: null });
    groupDb.listGroupDirectory.mockResolvedValue({ data: [{ membership_id: "membership-self", nickname: "WS10", role: "admin", avatar_id: "emoji_bolt", avatar_frame: "", avatar_frames_enabled: true }], error: null });
    const active = [];
    const generated = [
      { invite_id: "invite-1", invite_code: "one-use-first", code_hint: "one…irst", expires_at: "2026-09-17T12:00:00Z", max_uses: 1 },
      { invite_id: "invite-2", invite_code: "one-use-second", code_hint: "one…cond", expires_at: "2026-09-17T12:00:00Z", max_uses: 1 },
    ];
    groupDb.listGroupInvites.mockImplementation(async () => ({
      data: active.map((invite) => ({ id: invite.invite_id, code_hint: invite.code_hint, expires_at: invite.expires_at, max_uses: 1, use_count: 0, revoked_at: null })),
      error: null,
    }));
    groupDb.createGroupInvite.mockImplementation(async () => {
      const next = generated[active.length];
      active.push(next);
      return { data: next, error: null };
    });

    render(<GroupHub profiles={profiles} activeProfileId="profile-1" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByText("Invite settings"));
    const createButton = screen.getByRole("button", { name: "Create one-use invite" });
    fireEvent.click(createButton);
    expect(await screen.findByText("one-use-first")).toBeTruthy();
    expect(screen.getByText(/Shown in full only now/)).toBeTruthy();

    fireEvent.click(createButton);
    expect(await screen.findByText("one-use-second")).toBeTruthy();
    expect(screen.getByText("one-use-first")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Copy" }).length).toBe(2);
    expect(screen.getAllByRole("button", { name: "Revoke" }).length).toBe(2);
  });

  it("does not expose Admin join controls to an ordinary member", async () => {
    groupDb.listProfileGroups.mockResolvedValue({ data: [group({ membership: { ...group().membership, role: "member" } })], error: null });
    groupDb.listGroupDirectory.mockResolvedValue({ data: [{ membership_id: "membership-self", nickname: "WS10", role: "member", avatar_id: "emoji_bolt", avatar_frame: "", avatar_frames_enabled: true }], error: null });
    render(<GroupHub profiles={profiles} activeProfileId="profile-1" onClose={vi.fn()} />);
    expect(await screen.findByText("WS10 · You")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Copy invite link" })).toBeNull();
    expect(groupDb.getGroupJoinSettings).not.toHaveBeenCalled();
    expect(groupDb.listGroupJoinRequests).not.toHaveBeenCalled();
  });
});
