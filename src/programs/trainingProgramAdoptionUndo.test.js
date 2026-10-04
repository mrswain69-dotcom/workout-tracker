import fs from "node:fs";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  new URL("../../supabase/migrations/20261004161452_training_program_adoption_undo.sql", import.meta.url),
  "utf8"
);

describe("assigned Program adoption and undo security contract", () => {
  it("keeps exact prior plans in the private schema without client table access", () => {
    expect(migration).toContain("private.training_program_assignment_backups");
    expect(migration).toContain("previous_plan_json jsonb not null");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table private.training_program_assignment_backups from public, anon, authenticated");
  });

  it("supports the three explicit adoption modes", () => {
    expect(migration).toContain("'replace','add','replace_keep_tasks'");
    expect(migration).toContain("p_adoption_mode = 'add'");
    expect(migration).toContain("p_adoption_mode = 'replace_keep_tasks'");
    expect(migration).toContain("'programAddOns'");
  });

  it("only restores a backup while its assignment is still the active undo point", () => {
    expect(migration).toContain("training_program_undo_assignment");
    expect(migration).toContain("{meta,programAdoptionUndo,assignmentId}");
    expect(migration).toContain("is distinct from p_assignment_id::text");
    expect(migration).toContain("where b.assignment_id = p_assignment_id");
    expect(migration).toContain("and b.profile_id = p_profile_id");
  });

  it("exposes only the authenticated RPCs, never the private backup table", () => {
    expect(migration).toMatch(/revoke all on function public\.training_program_accept_assignment\(uuid,uuid,text,jsonb\)[\s\S]*from public, anon;/);
    expect(migration).toMatch(/grant execute on function public\.training_program_accept_assignment\(uuid,uuid,text,jsonb\)[\s\S]*to authenticated;/);
    expect(migration).toMatch(/revoke all on function public\.training_program_undo_assignment\(uuid,uuid\)[\s\S]*from public, anon;/);
    expect(migration).toMatch(/grant execute on function public\.training_program_undo_assignment\(uuid,uuid\)[\s\S]*to authenticated;/);
  });
});
