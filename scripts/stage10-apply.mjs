import fs from "node:fs";

function countOf(text, needle) {
  if (!needle) return 0;
  return text.split(needle).length - 1;
}

function replaceExact(text, needle, replacement, label, expectedCount = 1) {
  const count = countOf(text, needle);
  if (count !== expectedCount) {
    throw new Error(`${label}: expected ${expectedCount} match(es), found ${count}`);
  }
  return text.replace(needle, replacement);
}

function replaceAllExact(text, needle, replacement, label, expectedCount) {
  const count = countOf(text, needle);
  if (count !== expectedCount) {
    throw new Error(`${label}: expected ${expectedCount} match(es), found ${count}`);
  }
  return text.split(needle).join(replacement);
}

const appPath = "src/App.jsx";
let app = fs.readFileSync(appPath, "utf8");

app = replaceExact(
  app,
  'import { AVATAR_PACKS } from "./config/avatars";\n',
  'import { AVATAR_PACKS } from "./config/avatars";\nimport SessionPlanBlockEditor, {\n  createSessionPlanBlock,\n  normaliseSessionPlanBlock,\n} from "./components/sessions/SessionPlanBlockEditor.jsx";\n',
  "Session Plan import"
);

app = replaceExact(
  app,
  '    } else if (typeId === "tasks") {\n      newBlock = createTasksBlock();\n    } else {\n',
  '    } else if (typeId === "tasks") {\n      newBlock = createTasksBlock();\n    } else if (typeId === "session") {\n      newBlock = createSessionPlanBlock(uid());\n    } else {\n',
  "Session block creation"
);

app = replaceExact(
  app,
  '        // Fallback: unknown type → treat as duration block\n',
  '        if (typeId === "session") {\n          return normaliseSessionPlanBlock(\n            b,\n            b?.id || `${w}_block_${idx}`\n          );\n        }\n\n        // Fallback: unknown type → treat as duration block\n',
  "Session runtime normalisation"
);

app = replaceExact(
  app,
  '            No blocks yet for {planWeekday}. Add a strength, cardio, duration,\nrecovery, or tasks block below.\n',
  '            No blocks yet for {planWeekday}. Add a strength, cardio, duration,\n            recovery, session, or tasks block below.\n',
  "Plan empty-state Session copy"
);

const planPillNeedle = `                    {typeId === "duration" && "Duration"}\n                    {typeId === "recovery" && "Recovery"}\n                    {typeId === "tasks" && "Tasks"}`;
const planPillReplacement = `                    {typeId === "duration" && "Duration"}\n                    {typeId === "recovery" && "Recovery"}\n                    {typeId === "session" && "Session"}\n                    {typeId === "tasks" && "Tasks"}`;
app = replaceAllExact(
  app,
  planPillNeedle,
  planPillReplacement,
  "Plan clean/edit Session type pills",
  2
);

app = replaceExact(
  app,
  '                      : typeId === "tasks"\n                      ? "e.g. Recovery tasks"\n                      : "e.g. Upper body"\n',
  '                      : typeId === "tasks"\n                      ? "e.g. Recovery tasks"\n                      : typeId === "session"\n                      ? "e.g. Football Skills — Session A"\n                      : "e.g. Upper body"\n',
  "Session Plan label placeholder"
);

app = replaceExact(
  app,
  '              {typeId === "tasks" && (\n',
  '              {typeId === "session" && (\n                <SessionPlanBlockEditor\n                  familyId={family?.id}\n                  block={block}\n                  onChange={(patch) =>\n                    updateBlockInDay(block.id, () => patch)\n                  }\n                />\n              )}\n\n              {typeId === "tasks" && (\n',
  "Session Plan editor mount"
);

app = replaceExact(
  app,
  '          <PrimaryButton\n            className="btnSmall"\n            onClick={() => addBlockToDay("tasks")}\n          >\n            + Tasks block\n          </PrimaryButton>\n',
  '          <PrimaryButton\n            className="btnSmall"\n            onClick={() => addBlockToDay("session")}\n          >\n            + Session block\n          </PrimaryButton>\n          <PrimaryButton\n            className="btnSmall"\n            onClick={() => addBlockToDay("tasks")}\n          >\n            + Tasks block\n          </PrimaryButton>\n',
  "Session block add button"
);

app = replaceExact(
  app,
  '                        {b.typeId === "duration" && "Duration"}\n                        {b.typeId === "tasks" && "Tasks"}\n',
  '                        {b.typeId === "duration" && "Duration"}\n                        {b.typeId === "recovery" && "Recovery"}\n                        {b.typeId === "session" && "Session"}\n                        {b.typeId === "tasks" && "Tasks"}\n',
  "Weekly Session type pill"
);

app = replaceExact(
  app,
  '                        {b.label || "(no name)"}\n',
  '                        {b.label ||\n                          (b.typeId === "session"\n                            ? b.sessionTemplateNameSnapshot\n                            : "") ||\n                          "(no name)"}\n',
  "Weekly Session label fallback"
);

app = replaceExact(
  app,
  '                  <b>{block.label || "(no name yet)"}</b>\n',
  '                  <b>\n                    {block.label ||\n                      (typeId === "session"\n                        ? block.sessionTemplateNameSnapshot\n                        : "") ||\n                      "(no name yet)"}\n                  </b>\n',
  "Clean Plan Session label fallback"
);

fs.writeFileSync(appPath, app);

const editorPath = "src/components/sessions/SessionPlanBlockEditor.jsx";
let editor = fs.readFileSync(editorPath, "utf8");
editor = replaceExact(
  editor,
  'import { normaliseSessionLibrary } from "./sessionLibraryController.js";\n',
  'import { normaliseSessionLibrary } from "./sessionLibraryController.js";\n\nconst DEFAULT_DB_API = Object.freeze({ loadSessionLibrary });\n',
  "Stable Session Plan DB API"
);
editor = replaceExact(
  editor,
  '  dbApi = { loadSessionLibrary },\n',
  '  dbApi = DEFAULT_DB_API,\n',
  "Stable Session Plan DB API default"
);
fs.writeFileSync(editorPath, editor);

console.log("Stage 10 App integration patch applied successfully.");
