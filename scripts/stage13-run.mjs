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

const replacement = `// App green-day and same-day completion both use the same completion-only rule.\nconst completionPattern = /    } else if \\(typeId === \\\"recovery\\\"\\) \\{\\r?\\n[ \\t]+hasData = !!block\\?\\.recoveryDone;\\r?\\n[ \\t]+\\}/g;\nconst completionMatches = app.match(completionPattern) || [];\nif (completionMatches.length !== 2) {\n  throw new Error(\`Session completion in green/same-day checks: expected 2 regex matches, found \${completionMatches.length}\`);\n}\napp = app.replace(\n  completionPattern,\n  \`    } else if (typeId === \\\"session\\\") {\\n      hasData = sessionBlockIsComplete(block);\\n    } else if (typeId === \\\"recovery\\\") {\\n      hasData = !!block?.recoveryDone;\\n    }\`\n);\n\n`;

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(runtimePath, source);

try {
  await import(`./${runtimePath.split("/").pop()}?stage13=${Date.now()}`);
} finally {
  if (fs.existsSync(runtimePath)) fs.unlinkSync(runtimePath);
}
