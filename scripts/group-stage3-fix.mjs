import fs from 'node:fs';

function write(path, content) { fs.writeFileSync(path, content); }

// 1) Collapse any duplicated GroupWeeklyXp imports to exactly one.
{
  const path = 'src/groups/GroupHub.jsx';
  let text = fs.readFileSync(path, 'utf8');
  text = text.replace(/(?:import GroupWeeklyXp from "\.\/GroupWeeklyXp\.jsx";\n)+/g, 'import GroupWeeklyXp from "./GroupWeeklyXp.jsx";\n');
  const importCount = (text.match(/import GroupWeeklyXp from "\.\/GroupWeeklyXp\.jsx";/g) || []).length;
  const renderCount = (text.match(/<GroupWeeklyXp\b/g) || []).length;
  if (importCount !== 1 || renderCount !== 1) throw new Error(`GroupHub integration counts import=${importCount}, render=${renderCount}`);
  write(path, text);
}

// 2) React Testing Library needs jsdom explicitly in this repository.
{
  const path = 'src/groups/GroupWeeklyXp.test.jsx';
  let text = fs.readFileSync(path, 'utf8');
  if (!text.startsWith('// @vitest-environment jsdom')) text = `// @vitest-environment jsdom\n${text}`;
  write(path, text);
}

// 3) Apply the closed-week membership preservation directly and verify it landed.
{
  const path = 'supabase/functions/group-xp-leaderboard/index.ts';
  let text = fs.readFileSync(path, 'utf8');
  text = text.replace(
    `.select("id,profile_id,nickname,role,avatar_id,avatar_frame,avatar_frames_enabled")\n      .eq("group_id", groupId)\n      .eq("status", "active")\n      .order("joined_at", { ascending: true });`,
    `.select("id,profile_id,nickname,role,avatar_id,avatar_frame,avatar_frames_enabled,status,joined_at,left_at")\n      .eq("group_id", groupId)\n      .order("joined_at", { ascending: true });`
  );
  text = text.replace(
    `    const activeMembers = memberships || [];\n    const profileIds = activeMembers.map((member) => member.profile_id).filter(Boolean);`,
    `    const allMemberships = memberships || [];\n    const activeMembers = allMemberships.filter((member: any) => member.status === "active");\n    const profileIds = [...new Set(allMemberships.map((member: any) => member.profile_id).filter(Boolean))];`
  );
  text = text.replace(
    '    for (const member of activeMembers) {\n      ledgerByMembership.set(',
    '    for (const member of allMemberships) {\n      ledgerByMembership.set('
  );
  text = text.replace(
    `        const eligibleFrom = scopeMode === "group_start" ? maxYmd(window.startDate, groupStart) : window.startDate;\n        const inserts = activeMembers.map((member: any) => ({`,
    `        const eligibleFrom = scopeMode === "group_start" ? maxYmd(window.startDate, groupStart) : window.startDate;\n        const historyMembers = allMemberships.filter((member: any) => {\n          if (member.status === "active") return true;\n          const joinedDate = String(member.joined_at || "").slice(0, 10);\n          const leftDate = String(member.left_at || "").slice(0, 10);\n          return !!joinedDate && joinedDate <= window.endDate && (!leftDate || leftDate >= window.startDate);\n        });\n        const inserts = historyMembers.map((member: any) => ({`
  );
  for (const required of [
    'const allMemberships = memberships || [];',
    'member.status === "active"',
    'joinedDate <= window.endDate',
    'leftDate >= window.startDate',
    'const inserts = historyMembers.map',
  ]) if (!text.includes(required)) throw new Error(`Edge hardening missing: ${required}`);
  write(path, text);
}

console.log('Stage 3 mechanical fixes applied.');
