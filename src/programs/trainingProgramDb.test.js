import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../supabaseClient", () => ({
  supabase: {
    from: mock.from,
    rpc: mock.rpc,
  },
}));

import {
  assignTrainingProgramToMembers,
  listManagedTrainingProgramAssignments,
  revokeTrainingProgramAssignment,
} from "./trainingProgramDb.js";

function queryChain(data = []) {
  const chain = {
    data,
    error: null,
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    in: vi.fn(),
  };
  for (const method of ["select", "eq", "order", "limit", "in"]) {
    chain[method].mockReturnValue(chain);
  }
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("coach Program assignment DB adapter", () => {
  it("assigns a frozen Program version to unique selected membership IDs", async () => {
    mock.rpc.mockResolvedValue({ data: 2, error: null });

    const result = await assignTrainingProgramToMembers({
      programId: "program-1",
      membershipIds: ["member-1", "member-2", "member-1", ""],
      startDate: "2026-10-05",
      completionMode: "hold",
      recipientCanEdit: true,
      message: "Build steadily",
    });

    expect(mock.rpc).toHaveBeenCalledWith("training_program_assign_members", {
      p_program_id: "program-1",
      p_membership_ids: ["member-1", "member-2"],
      p_start_date: "2026-10-05",
      p_completion_mode: "hold",
      p_recipient_can_edit: true,
      p_message: "Build steadily",
    });
    expect(result.data).toBe(2);
  });

  it("enriches sent assignments without reading private profiles", async () => {
    const rows = {
      training_program_assignments: [{
        id: "assignment-1",
        program_id: "program-1",
        version_id: "version-1",
        target_membership_id: "member-1",
        status: "pending",
      }],
      training_programs: [{ id: "program-1", title: "Match preparation" }],
      training_program_versions: [{ id: "version-1", version_no: 3 }],
      group_member_directory: [{ membership_id: "member-1", group_id: "group-1", nickname: "Rocket" }],
    };
    mock.from.mockImplementation((table) => queryChain(rows[table] || []));

    const result = await listManagedTrainingProgramAssignments("family-1");

    expect(result.data[0]).toEqual(expect.objectContaining({
      recipient: expect.objectContaining({ nickname: "Rocket" }),
      program: { id: "program-1", title: "Match preparation" },
      version: { id: "version-1", version_no: 3 },
    }));
    expect(mock.from.mock.calls.map(([table]) => table)).not.toContain("profiles");
  });

  it("uses the protected revocation RPC", async () => {
    mock.rpc.mockResolvedValue({ data: true, error: null });
    await revokeTrainingProgramAssignment("assignment-1");
    expect(mock.rpc).toHaveBeenCalledWith("training_program_revoke_assignment", {
      p_assignment_id: "assignment-1",
    });
  });
});
