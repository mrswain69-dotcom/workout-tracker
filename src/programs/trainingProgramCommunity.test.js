import fs from "node:fs";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  new URL("../../supabase/migrations/20261007114500_training_program_community_free_foundation.sql", import.meta.url),
  "utf8"
);

describe("free Community Program foundation contract", () => {
  it("publishes only through owner-scoped authenticated functions", () => {
    expect(migration).toContain("training_program_publish_free");
    expect(migration).toContain("private.training_program_owned_family(v_family_id)");
    expect(migration).toContain("marketplace_status = 'published'");
    expect(migration).toContain("access_model = 'free'");
    expect(migration).toMatch(/revoke all on function public\.training_program_publish_free\(uuid\) from public, anon;/);
  });

  it("exposes safe catalogue metadata without opening raw Program table access", () => {
    expect(migration).toContain("training_program_list_community");
    expect(migration).toContain("training_program_preview_community");
    expect(migration).toContain("and p.marketplace_status = 'published'");
    expect(migration).toContain("and p.access_model = 'free'");
    expect(migration).not.toMatch(/grant select on public\.training_programs to authenticated/i);
  });

  it("keeps all three adoption modes behind profile ownership and the one-add-on limit", () => {
    expect(migration).toContain("p_adoption_mode not in ('replace','add','replace_keep_tasks')");
    expect(migration).toContain("f.owner_user_id = (select auth.uid())");
    expect(migration).toContain("jsonb_array_length(v_addons) >= 1");
    expect(migration).toContain("You already have one Program running alongside your base plan");
    expect(migration).toContain("training_program_validate_content(p_prepared_plan - 'meta')");
  });

  it("does not let generic adoption bypass assignment or share permissions", () => {
    expect(migration).toContain("e.source_kind in ('free','purchase','creator_subscription','admin')");
    expect(migration).not.toContain("e.source_kind in ('free','purchase','creator_subscription','assignment','share','admin')");
  });

  it("removes generic add-ons without allowing assignment removal through the generic path", () => {
    expect(migration).toContain("training_program_remove_library_add_on");
    expect(migration).toContain("not in ('owner','free','purchase','creator_subscription','admin')");
    expect(migration).toContain("This added Program must be removed through its assignment");
  });
});
