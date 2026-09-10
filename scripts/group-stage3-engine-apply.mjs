import fs from 'node:fs';

function replaceOnce(path, from, to) {
  const before = fs.readFileSync(path, 'utf8');
  const count = before.split(from).length - 1;
  if (count === 0 && before.includes(to)) return;
  if (count !== 1) throw new Error(`${path}: expected one anchor, found ${count}`);
  fs.writeFileSync(path, before.replace(from, to));
}

replaceOnce(
  'src/engine/xpEngine.js',
  'import { BADGE_DEFS } from "../config/badges.js";',
  'import { BADGE_XP_BY_KEY } from "./xpRewardMap.generated.js";'
);

replaceOnce(
  'src/engine/xpEngine.js',
  `export function getRewardXpForKey(key) {\n  const badge = BADGE_DEFS.find((definition) => definition.key === key);\n  return badge ? safeNumber(badge.xp) : getSportAvatarXpForKey(key);\n}`,
  `export function getRewardXpForKey(key) {\n  return safeNumber(BADGE_XP_BY_KEY[key]) || getSportAvatarXpForKey(key);\n}`
);

replaceOnce(
  'src/App.jsx',
  'import { buildBadgeStatsV2 } from "./engine/badgeStatsV2";',
  `import { buildBadgeStatsV2 } from "./engine/badgeStatsV2";\nimport {\n  buildXpDebugRows as buildXpDebugRowsEngine,\n  computeXpFromLogs as computeXpFromLogsEngine,\n} from "./engine/xpEngine.js";`
);

replaceOnce(
  'src/App.jsx',
  'setXp(computeXpFromLogs(allLogs, plan));',
  'setXp(computeXpFromLogsEngine(allLogs, plan));'
);

replaceOnce(
  'src/App.jsx',
  '() => buildXpDebugRows(allLogs, plan),',
  '() => buildXpDebugRowsEngine(allLogs, plan),'
);

replaceOnce(
  'supabase/functions/group-xp-leaderboard/index.ts',
  'from "../../../src/engine/xpEngine.js";',
  'from "./xpEngine.js";'
);

fs.copyFileSync('src/engine/xpEngine.js', 'supabase/functions/group-xp-leaderboard/xpEngine.js');
fs.copyFileSync('src/engine/xpRewardMap.generated.js', 'supabase/functions/group-xp-leaderboard/xpRewardMap.generated.js');

const contractTest = `import fs from "node:fs";\nimport { describe, expect, it } from "vitest";\nimport { BADGE_DEFS } from "../config/badges.js";\nimport { BADGE_XP_BY_KEY } from "./xpRewardMap.generated.js";\n\ndescribe("Stage 3 XP integration", () => {\n  it("keeps the generated badge XP lookup in parity with the badge catalogue", () => {\n    for (const badge of BADGE_DEFS) {\n      expect(BADGE_XP_BY_KEY[badge.key]).toBe(Number(badge.xp) || 0);\n    }\n    expect(Object.keys(BADGE_XP_BY_KEY).sort()).toEqual(BADGE_DEFS.map((badge) => badge.key).sort());\n  });\n\n  it("routes the athlete XP display through the shared engine", () => {\n    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");\n    expect(app).toContain("computeXpFromLogs as computeXpFromLogsEngine");\n    expect(app).toContain("buildXpDebugRows as buildXpDebugRowsEngine");\n    expect(app).toContain("setXp(computeXpFromLogsEngine(allLogs, plan))");\n    expect(app).toContain("() => buildXpDebugRowsEngine(allLogs, plan)");\n  });\n\n  it("deploys the exact shared engine files with the Edge Function", () => {\n    const sourceEngine = fs.readFileSync(new URL("./xpEngine.js", import.meta.url), "utf8");\n    const edgeEngine = fs.readFileSync(new URL("../../supabase/functions/group-xp-leaderboard/xpEngine.js", import.meta.url), "utf8");\n    const sourceRewards = fs.readFileSync(new URL("./xpRewardMap.generated.js", import.meta.url), "utf8");\n    const edgeRewards = fs.readFileSync(new URL("../../supabase/functions/group-xp-leaderboard/xpRewardMap.generated.js", import.meta.url), "utf8");\n    expect(edgeEngine).toBe(sourceEngine);\n    expect(edgeRewards).toBe(sourceRewards);\n  });\n});\n`;
fs.writeFileSync('src/engine/xpEngineIntegration.test.js', contractTest);

console.log('Stage 3 XP engine integration applied.');
