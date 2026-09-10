import fs from "node:fs";
import path from "node:path";
import { BADGE_DEFS } from "../src/config/badges.js";

const map = Object.fromEntries(
  (BADGE_DEFS || [])
    .filter((entry) => entry?.key && Number.isFinite(Number(entry?.xp)))
    .map((entry) => [entry.key, Number(entry.xp)])
    .sort(([a], [b]) => a.localeCompare(b))
);

const out = `// AUTO-GENERATED from src/config/badges.js. Do not hand-edit.\nexport const BADGE_XP_BY_KEY = Object.freeze(${JSON.stringify(map, null, 2)});\n`;
const target = path.resolve("src/engine/xpRewardMap.generated.js");
fs.writeFileSync(target, out, "utf8");
console.log(`generated ${target} with ${Object.keys(map).length} badge reward keys`);
