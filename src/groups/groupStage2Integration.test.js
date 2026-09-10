import fs from "node:fs";
import { describe, expect, it } from "vitest";

const app = fs.readFileSync("src/App.jsx", "utf8");
const hub = fs.readFileSync("src/groups/GroupHub.jsx", "utf8");
const db = fs.readFileSync("src/groups/groupDb.js", "utf8");
const css = fs.readFileSync("src/groups/GroupHub.css", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260910150000_group_team_stage2_actions.sql", "utf8");

describe("Group & Team Stage 2 integration contract", () => {
  it("mounts Groups beside athlete identity without adding a sixth main navigation tab", () => {
    expect(app.match(/React\.lazy\(\(\) => import\("\.\/groups\/GroupHub\.jsx"\)\)/g)?.length).toBe(1);
    expect(app.match(/className="groupHeaderButton"/g)?.length).toBe(1);
    expect(app).toContain('aria-label="Open Groups"');
    expect(app).toContain("showGroups &&");
    expect(app).toContain("<GroupHub");
    expect(app).toContain('["log", "stats", "plan", "assessments", "rewards"]');
    expect(app).not.toContain('["log", "stats", "plan", "assessments", "rewards", "groups"]');
  });

  it("keeps Group mutations behind RPCs and reads the deliberately safe directory surface", () => {
    expect(db).toContain('.from("group_member_directory")');
    expect(db).toContain('"membership_id,group_id,nickname,role,avatar_id,avatar_frame,avatar_frames_enabled,joined_at,updated_at"');
    expect(db).not.toContain('"membership_id,group_id,family_id,profile_id');
    for (const rpc of [
      "group_create",
      "group_create_invite",
      "group_preview_invite",
      "group_join",
      "group_update_nickname",
      "group_leave",
      "group_update_details",
      "group_set_member_role",
      "group_remove_member",
      "group_revoke_invite",
    ]) {
      expect(db).toContain(`rpc("${rpc}"`);
    }
    expect(db).not.toMatch(/\.from\("group_(?:memberships|member_directory|invites)"\)\s*\.insert\(/s);
    expect(db).not.toMatch(/\.from\("groups"\)\s*\.insert\(/s);
  });

  it("keeps the Stage 2 server actions authenticated, hardened and cosmetic-only", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("extensions.gen_random_bytes(18)");
    expect(migration).toContain("extensions.digest(v_code, 'sha256')");
    expect(migration).toContain("grant execute on function public.group_join(uuid,text,text) to authenticated");
    expect(migration).toContain("revoke execute on function public.group_join(uuid,text,text) from public, anon, authenticated");
    expect(migration).toContain("trg_profiles_sync_group_cosmetics");
    expect(migration).not.toContain("body_weight_kg");
    expect(migration).not.toContain("assessment_test_results");
  });

  it("keeps the first Group UI focused on membership rather than pretending leaderboards exist", () => {
    expect(hub).toContain("My Groups");
    expect(hub).toContain("Join");
    expect(hub).toContain("Create");
    expect(hub).toContain("Group nickname");
    expect(hub).toContain("selected avatar and selected cosmetic frame/glow");
    expect(hub).not.toContain("Leaderboards");
    expect(hub).not.toContain("Weekly XP");
    expect(css).toMatch(/\.groupHeaderButton\{[^}]*width:44px[^}]*height:44px/s);
  });
});
