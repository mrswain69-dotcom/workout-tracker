// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("../supabaseClient", () => ({ supabase: mock }));
import { readCoachInvite, coachInviteUrl, previewCoachInvite, inviteCoachClient, assignProgramToClients } from "./coachClientDb.js";
const token = "12345678-1234-1234-1234-123456789012";
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState(null, "", "/"); });
describe("coaching invitation API", () => {
  it("accepts a UUID capability or invitation URL and rejects arbitrary values", () => {
    expect(readCoachInvite(token)).toBe(token);
    expect(readCoachInvite(`https://tracker.example/?coachInvite=${token}`)).toBe(token);
    expect(readCoachInvite("garbage")).toBe("");
    expect(readCoachInvite("https://tracker.example/?coachInvite=bad")).toBe("");
  });
  it("creates a link without an unrelated programme sharing token", () => {
    window.history.replaceState(null, "", "/?programShare=old#log");
    const url = new URL(coachInviteUrl(token));
    expect(url.searchParams.get("coachInvite")).toBe(token);
    expect(url.searchParams.has("programShare")).toBe(false);
    expect(url.hash).toBe("");
  });
  it("normalises RPC row arrays and unavailable invitation previews", async () => {
    mock.rpc.mockResolvedValueOnce({ data: [{ coach_name: "Sam" }], error: null }).mockResolvedValueOnce({ data: [], error: null });
    expect((await previewCoachInvite(token)).data).toEqual({ coach_name: "Sam" });
    expect((await previewCoachInvite(token)).data).toBeNull();
  });
  it("passes the selected profile, display name and expiry to the owner checked RPC", async () => {
    mock.rpc.mockResolvedValue({ data: [{ id: "invite" }], error: null });
    expect((await inviteCoachClient("coach", " Sam ", 7)).data).toEqual({ id: "invite" });
    expect(mock.rpc).toHaveBeenCalledWith("training_program_invite_client", { p_coach_profile_id: "coach", p_coach_name: "Sam", p_expires_in_days: 7 });
  });
  it("passes explicit direct-client permissions without team identifiers", async () => {
    mock.rpc.mockResolvedValue({ data: 2, error: null });
    await assignProgramToClients({ programId: "programme", connectionIds: ["a", "b"], startDate: "2026-10-12", completionMode: "once", recipientCanEdit: false, recipientCanCopy: false, message: "Coach note" });
    expect(mock.rpc).toHaveBeenCalledWith("training_program_assign_clients", { p_program_id: "programme", p_connection_ids: ["a", "b"], p_start_date: "2026-10-12", p_completion_mode: "once", p_can_edit: false, p_can_copy: false, p_message: "Coach note" });
  });
});
