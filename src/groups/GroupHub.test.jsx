// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./groupDb", () => ({
  createGroup: vi.fn(),
  createGroupInvite: vi.fn(),
  joinGroup: vi.fn(),
  leaveGroup: vi.fn(),
  listGroupDirectory: vi.fn(),
  listGroupInvites: vi.fn(),
  listProfileGroups: vi.fn(),
  previewGroupInvite: vi.fn(),
  removeGroupMember: vi.fn(),
  revokeGroupInvite: vi.fn(),
  setGroupMemberRole: vi.fn(),
  updateGroupDetails: vi.fn(),
  updateGroupNickname: vi.fn(),
  loadGroupXpLeaderboard: vi.fn(),
  loadGroupConsistencyLeaderboard: vi.fn(),
  updateGroupXpHistoryScope: vi.fn(),
}));

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
    max_members: 20,
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
  groupDb.listProfileGroups.mockResolvedValue({ data: [], error: null });
  groupDb.listGroupDirectory.mockResolvedValue({ data: [], error: null });
  groupDb.listGroupInvites.mockResolvedValue({ data: [], error: null });
  groupDb.loadGroupXpLeaderboard.mockResolvedValue({
    data: {
      scoreVersion: 1,
      scopeMode: "group_start",
      competitionStartDate: "2026-09-10",
      current: { startDate: "2026-09-07", endDate: "2026-09-13", state: "live", available: true, rows: [] },
      history: [],
    },
    error: null,
  });
  groupDb.loadGroupConsistencyLeaderboard.mockResolvedValue({
    data: {
      scoreVersion: 1,
      scopeMode: "group_start",
      competitionStartDate: "2026-09-10",
      current: { startDate: "2026-09-07", endDate: "2026-09-13", state: "live", available: true, rows: [] },
      history: [],
    },
    error: null,
  });
  groupDb.updateGroupXpHistoryScope.mockResolvedValue({ data: { xp_history_scope: "group_start" }, error: null });
});

afterEach(() => cleanup());

describe("Group & Team Stage 2 GroupHub", () => {
  it("renders a deliberate empty state with Create and Join paths", async () => {
    render(<GroupHub profiles={profiles} activeProfileId="profile-1" onClose={vi.fn()} />);
    expect(await screen.findByText(/No Groups yet/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Join" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
  });

  it("creates a Group with the active athlete and independent Group nickname", async () => {
    groupDb.createGroup.mockResolvedValue({ data: { group_id: "new-group", membership_id: "new-membership" }, error: null });
    groupDb.listProfileGroups
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [group({ id: "new-group", name: "New Squad" })], error: null });

    render(<GroupHub profiles={profiles} activeProfileId="profile-1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Falcons Performance Squad"), { target: { value: "New Squad" } });
    fireEvent.change(screen.getByPlaceholderText("Shown to this Group"), { target: { value: "Rocket 10" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Group" }));

    await waitFor(() => expect(groupDb.createGroup).toHaveBeenCalledWith(expect.objectContaining({
      profileId: "profile-1",
      name: "New Squad",
      nickname: "Rocket 10",
    })));
  });

  it("previews an invite without needing Group membership and joins using a pseudonym", async () => {
    groupDb.previewGroupInvite.mockResolvedValue({ data: { group_id: "g2", group_name: "Sprint Crew", group_type: "private", expires_at: "2026-09-17T12:00:00Z", remaining_uses: 1 }, error: null });
    groupDb.joinGroup.mockResolvedValue({ data: { group_id: "g2", membership_id: "m2" }, error: null });
    groupDb.listProfileGroups
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [group({ id: "g2", name: "Sprint Crew", membership: { ...group().membership, id: "m2", nickname: "The Rocket", role: "member" } })], error: null });

    render(<GroupHub profiles={profiles} activeProfileId="profile-1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    fireEvent.change(screen.getByPlaceholderText("Paste invite code"), { target: { value: "abc123" } });
    fireEvent.click(screen.getByRole("button", { name: "Check invite" }));
    expect(await screen.findByText("Sprint Crew")).toBeTruthy();
    const nicknameInput = screen.getByLabelText("Your nickname in this Group");
    fireEvent.change(nicknameInput, { target: { value: "The Rocket" } });
    fireEvent.click(screen.getByRole("button", { name: "Join Group" }));

    await waitFor(() => expect(groupDb.joinGroup).toHaveBeenCalledWith({
      profileId: "profile-1",
      inviteCode: "abc123",
      nickname: "The Rocket",
    }));
  });

  it("renders only safe member identity fields and Admin controls", async () => {
    groupDb.listProfileGroups.mockResolvedValue({ data: [group()], error: null });
    groupDb.listGroupDirectory.mockResolvedValue({ data: [
      { membership_id: "membership-self", group_id: "group-1", nickname: "WS10", role: "admin", avatar_id: "emoji_bolt", avatar_frame: "prestige_cyan_gold", avatar_frames_enabled: true, joined_at: "2026-09-10T12:00:00Z" },
      { membership_id: "membership-other", group_id: "group-1", nickname: "Shadow", role: "member", avatar_id: "emoji_tiger", avatar_frame: "", avatar_frames_enabled: true, joined_at: "2026-09-10T12:05:00Z" },
    ], error: null });

    render(<GroupHub profiles={profiles} activeProfileId="profile-1" onClose={vi.fn()} />);
    expect(await screen.findByText("Shadow")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create invite" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Make admin" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
    expect(screen.queryByText("body_weight_kg")).toBeNull();
  });

  it("shows a newly generated invite secret once and keeps stored invites as hints", async () => {
    groupDb.listProfileGroups.mockResolvedValue({ data: [group()], error: null });
    groupDb.listGroupDirectory.mockResolvedValue({ data: [{ membership_id: "membership-self", nickname: "WS10", role: "admin", avatar_id: "emoji_bolt", avatar_frame: "", avatar_frames_enabled: true }], error: null });
    groupDb.createGroupInvite.mockResolvedValue({ data: { invite_id: "invite-1", invite_code: "0123456789abcdef0123456789abcdef0123", code_hint: "0123…0123", expires_at: "2026-09-17T12:00:00Z", max_uses: 1 }, error: null });

    render(<GroupHub profiles={profiles} activeProfileId="profile-1" onClose={vi.fn()} />);
    const inviteButton = await screen.findByRole("button", { name: "Create invite" });
    fireEvent.click(inviteButton);
    expect(await screen.findByText("0123456789abcdef0123456789abcdef0123")).toBeTruthy();
    expect(screen.getByText(/Shown in full only now/)).toBeTruthy();
  });

  it("does not expose Admin invite controls to an ordinary member", async () => {
    groupDb.listProfileGroups.mockResolvedValue({ data: [group({ membership: { ...group().membership, role: "member" } })], error: null });
    groupDb.listGroupDirectory.mockResolvedValue({ data: [{ membership_id: "membership-self", nickname: "WS10", role: "member", avatar_id: "emoji_bolt", avatar_frame: "", avatar_frames_enabled: true }], error: null });

    render(<GroupHub profiles={profiles} activeProfileId="profile-1" onClose={vi.fn()} />);
    expect(await screen.findByText("WS10 · You")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create invite" })).toBeNull();
    expect(groupDb.listGroupInvites).not.toHaveBeenCalled();
  });
});
