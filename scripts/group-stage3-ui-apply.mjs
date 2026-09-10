import fs from 'node:fs';

function replaceOnce(path, from, to) {
  const before = fs.readFileSync(path, 'utf8');
  const count = before.split(from).length - 1;
  if (count === 0 && before.includes(to)) return;
  if (count !== 1) throw new Error(`${path}: expected one anchor, found ${count}`);
  fs.writeFileSync(path, before.replace(from, to));
}

replaceOnce(
  'src/groups/groupDb.js',
  '.select("id,name,description,group_type,status,max_members,created_at,updated_at")',
  '.select("id,name,description,group_type,status,max_members,competition_start_date,xp_history_scope,created_at,updated_at")'
);

const dbAppend = `\n\nexport async function updateGroupXpHistoryScope(groupId, scope) {\n  if (!supabase) return unavailable();\n  const { data, error } = await supabase.rpc("group_update_xp_history_scope", {\n    p_group_id: groupId,\n    p_scope: scope,\n  });\n  return { data: firstRow(data), error };\n}\n\nexport async function loadGroupXpLeaderboard(groupId, membershipId, referenceDate = null) {\n  if (!supabase) return unavailable();\n  if (!groupId || !membershipId) return { data: null, error: new Error("Group membership is required") };\n  const body = { groupId, membershipId };\n  if (referenceDate) body.referenceDate = referenceDate;\n  const { data, error } = await supabase.functions.invoke("group-xp-leaderboard", { body });\n  return { data: data || null, error };\n}\n`;
const dbPath = 'src/groups/groupDb.js';
let db = fs.readFileSync(dbPath, 'utf8');
if (!db.includes('export async function loadGroupXpLeaderboard')) {
  db += dbAppend;
  fs.writeFileSync(dbPath, db);
}

replaceOnce(
  'src/groups/GroupHub.jsx',
  'import { groupAvatarFrameClass, resolveGroupAvatar } from "./groupIdentity";',
  'import { groupAvatarFrameClass, resolveGroupAvatar } from "./groupIdentity";\nimport GroupWeeklyXp from "./GroupWeeklyXp.jsx";'
);

replaceOnce(
  'src/groups/GroupHub.jsx',
  `                  <div className="groupHubOwnIdentity">\n                    <MemberIdentity member={{ ...ownMembership, membership_id: ownMembership.id }} isSelf />\n                    <button className="groupHubSecondary" onClick={handleNicknameSave} disabled={busy}>Edit nickname</button>\n                  </div>\n\n                  <section className="groupHubPanel">`,
  `                  <div className="groupHubOwnIdentity">\n                    <MemberIdentity member={{ ...ownMembership, membership_id: ownMembership.id }} isSelf />\n                    <button className="groupHubSecondary" onClick={handleNicknameSave} disabled={busy}>Edit nickname</button>\n                  </div>\n\n                  <GroupWeeklyXp\n                    group={selectedGroup}\n                    membership={ownMembership}\n                    isAdmin={isAdmin}\n                    onGroupChanged={refreshGroups}\n                  />\n\n                  <section className="groupHubPanel">`
);

replaceOnce(
  'src/groups/GroupHub.test.jsx',
  '  updateGroupNickname: vi.fn(),\n}));',
  '  updateGroupNickname: vi.fn(),\n  loadGroupXpLeaderboard: vi.fn(),\n  updateGroupXpHistoryScope: vi.fn(),\n}));'
);

replaceOnce(
  'src/groups/GroupHub.test.jsx',
  '  groupDb.listGroupInvites.mockResolvedValue({ data: [], error: null });',
  `  groupDb.listGroupInvites.mockResolvedValue({ data: [], error: null });\n  groupDb.loadGroupXpLeaderboard.mockResolvedValue({\n    data: {\n      scoreVersion: 1,\n      scopeMode: "group_start",\n      competitionStartDate: "2026-09-10",\n      current: { startDate: "2026-09-07", endDate: "2026-09-13", state: "live", available: true, rows: [] },\n      history: [],\n    },\n    error: null,\n  });\n  groupDb.updateGroupXpHistoryScope.mockResolvedValue({ data: { xp_history_scope: "group_start" }, error: null });`
);

const contract = `import fs from "node:fs";\nimport { describe, expect, it } from "vitest";\n\ndescribe("Group Stage 3 integration contract", () => {\n  it("keeps Group mutations server-authorized and leaderboard scoring in the Edge Function", () => {\n    const db = fs.readFileSync(new URL("./groupDb.js", import.meta.url), "utf8");\n    expect(db).toContain('supabase.functions.invoke("group-xp-leaderboard"');\n    expect(db).toContain('supabase.rpc("group_update_xp_history_scope"');\n    expect(db).not.toMatch(/from\("group_weekly_xp_results"\).*\.(insert|update|upsert|delete)/s);\n  });\n\n  it("renders Weekly XP before the member-management panel", () => {\n    const hub = fs.readFileSync(new URL("./GroupHub.jsx", import.meta.url), "utf8");\n    expect(hub.indexOf("<GroupWeeklyXp")).toBeGreaterThan(-1);\n    expect(hub.indexOf("<GroupWeeklyXp")).toBeLessThan(hub.indexOf("<h4>Members</h4>"));\n  });\n\n  it("does not add untruthful Improvement or Consistency leaderboard placeholders", () => {\n    const weekly = fs.readFileSync(new URL("./GroupWeeklyXp.jsx", import.meta.url), "utf8");\n    expect(weekly).not.toContain("Improvement leaderboard");\n    expect(weekly).not.toContain("Consistency leaderboard");\n  });\n});\n`;
fs.writeFileSync('src/groups/groupStage3Integration.test.js', contract);

console.log('Stage 3 Group leaderboard UI integration applied.');
