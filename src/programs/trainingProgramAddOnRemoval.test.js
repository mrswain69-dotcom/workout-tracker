import fs from "node:fs";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  new URL("../../supabase/migrations/20261004164000_training_program_add_on_limit_removal.sql", import.meta.url),
  "utf8"
);

describe("assigned Program add-on limit and removal contract", () => {
  it("enforces one add-on at the profile plan boundary", () => {
    expect(migration).toContain("profiles_plan_max_one_program_add_on");
    expect(migration).toContain("jsonb_array_length(plan_json #> '{meta,programAddOns}') <= 1");
    expect(migration).toContain("validate constraint profiles_plan_max_one_program_add_on");
  });

  it("removes only an accepted active add-on belonging to the recipient", () => {
    expect(migration).toContain("training_program_remove_add_on");
    expect(migration).toContain("a.adoption_mode = 'add'");
    expect(migration).toContain("coalesce(a.target_profile_id, gm.profile_id)");
    expect(migration).toContain("f.owner_user_id = (select auth.uid())");
    expect(migration).toContain("addon->>'id' is distinct from p_assignment_id::text");
  });

  it("keeps removal unavailable to anonymous callers", () => {
    expect(migration).toMatch(/revoke all on function public\.training_program_remove_add_on\(uuid,uuid\)[\s\S]*from public, anon;/);
    expect(migration).toMatch(/grant execute on function public\.training_program_remove_add_on\(uuid,uuid\)[\s\S]*to authenticated;/);
  });
});
