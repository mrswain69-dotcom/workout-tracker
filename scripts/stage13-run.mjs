import fs from "node:fs";

const sourcePath = "scripts/stage13-apply.mjs";
const runtimePath = "scripts/.stage13-apply-runtime.mjs";
let source = fs.readFileSync(sourcePath, "utf8");

const startMarker = "// App green-day and same-day completion both use the same completion-only rule.\n";
const endMarker = "app = replaceExact(\n  app,\n  `  // 2) New model: sum minutes from per-block cardio + duration";

const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start + startMarker.length);
if (start < 0 || end < 0 || end <= start) {
  throw new Error("Could not locate Stage 13 completion patch section safely.");
}

const completionReplacement = `// App green-day and same-day completion both use the same completion-only rule.\nfunction patchSessionCompletionFunction(functionName, nextFunctionName) {\n  const functionStart = app.indexOf("function " + functionName + "(");\n  const functionEnd = app.indexOf("function " + nextFunctionName + "(", functionStart + 1);\n  if (functionStart < 0 || functionEnd < 0 || functionEnd <= functionStart) {\n    throw new Error("Could not isolate " + functionName + " safely.");\n  }\n\n  let section = app.slice(functionStart, functionEnd);\n  const recoveryPattern = /}\\s*else if\\s*\\(typeId\\s*===\\s*"recovery"\\)\\s*\\{\\s*hasData\\s*=\\s*!!block\\?\\.recoveryDone;\\s*}/g;\n  const matches = section.match(recoveryPattern) || [];\n  if (matches.length !== 1) {\n    throw new Error(functionName + ": expected exactly one recovery branch, found " + matches.length);\n  }\n\n  section = section.replace(\n    recoveryPattern,\n    '} else if (typeId === "session") {\\n      hasData = sessionBlockIsComplete(block);\\n    } else if (typeId === "recovery") {\\n      hasData = !!block?.recoveryDone;\\n    }'\n  );\n  app = app.slice(0, functionStart) + section + app.slice(functionEnd);\n}\n\npatchSessionCompletionFunction("isDayGreen", "sameYmdFromIso");\npatchSessionCompletionFunction("blockHasSameDayLoggedActivity", "isEligibleForSameDayDailyBonus");\n\n`;

source = source.slice(0, start) + completionReplacement + source.slice(end);

const badgeReadNeedle = `let badge = fs.readFileSync(badgePath, "utf8");`;
const badgeReadCount = source.split(badgeReadNeedle).length - 1;
if (badgeReadCount !== 1) {
  throw new Error(`Could not isolate badgeStatsV2 read safely; found ${badgeReadCount}.`);
}
source = source.replace(
  badgeReadNeedle,
  `${badgeReadNeedle}\nbadge = badge.replace(/\\r\\n/g, "\\n");`
);

const oldBadgeImportPatch = `badge = replaceExact(\n  badge,\n  \`// src/engine/badgeStatsV2.js\\n//\`,\n  \`// src/engine/badgeStatsV2.js\\nimport {\\n  sessionBlockHasActivity,\\n  sessionBlockIsComplete,\\n} from "./sessionCore.js";\\n\\n//\`,\n  "Session core badge import"\n);`;

const badgePatchCount = source.split(oldBadgeImportPatch).length - 1;
if (badgePatchCount !== 1) {
  throw new Error(`Could not isolate Session core badge import patch safely; found ${badgePatchCount}.`);
}

const badgeImportReplacement = `const badgeHeaderPattern = /^\\/\\/ src\\/engine\\/badgeStatsV2\\.js\\r?\\n\\/\\/\\r?\\n/;\nif (!badgeHeaderPattern.test(badge)) {\n  throw new Error("Session core badge import: expected badgeStatsV2 header at file start");\n}\nbadge = badge.replace(\n  badgeHeaderPattern,\n  \`// src/engine/badgeStatsV2.js\\nimport {\\n  sessionBlockHasActivity,\\n  sessionBlockIsComplete,\\n} from "./sessionCore.js";\\n\\n//\\n\`\n);`;

source = source.replace(oldBadgeImportPatch, badgeImportReplacement);
fs.writeFileSync(runtimePath, source);

try {
  await import(`./${runtimePath.split("/").pop()}?stage13=${Date.now()}`);
} finally {
  if (fs.existsSync(runtimePath)) fs.unlinkSync(runtimePath);
}
