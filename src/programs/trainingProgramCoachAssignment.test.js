import fs from "node:fs";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  new URL("../../supabase/migrations/20261003140252_training_program_coach_assignments.sql", import.meta.url),
  "utf8"
);

describe("coach/client Program assignment security contract", () => {
  it("authorizes selected recipients through active administered Group memberships", () => {
    expect(migration).toContain("training_program_assign_members");
    expect(migration).toContain("select distinct unnest(p_membership_ids)");
    expect(migration).toMatch(/target\.status = 'active'/);
    expect(migration).toMatch(/admin_membership\.role = 'admin'/);
    expect(migration).toContain("admin_family.owner_user_id = (select auth.uid())");
    expect(migration).toContain("private.training_program_owned_family(v_family_id)");
  });

  it("only revokes pending assignments owned by the assigning family", () => {
    expect(migration).toContain("training_program_revoke_assignment");
    expect(migration).toMatch(/assignment\.status = 'pending'/);
    expect(migration).toContain("private.training_program_owned_family(assignment.assigned_by_family_id)");
    expect(migration).toContain("set status = 'revoked', responded_at = now()");
  });

  it("does not expose the security-definer RPCs to anonymous callers", () => {
    expect(migration).toMatch(/revoke all on function public\.training_program_assign_members[\s\S]*from public, anon;/);
    expect(migration).toMatch(/revoke all on function public\.training_program_revoke_assignment[\s\S]*from public, anon;/);
    expect(migration).toMatch(/grant execute on function public\.training_program_assign_members[\s\S]*to authenticated;/);
    expect(migration).toMatch(/grant execute on function public\.training_program_revoke_assignment[\s\S]*to authenticated;/);
  });
});
