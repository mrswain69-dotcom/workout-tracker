import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`);
  return source.replace(before, after);
}

const appPath = "src/App.jsx";
let app = fs.readFileSync(appPath, "utf8");
app = replaceOnce(
  app,
  '  const [allLogs, setAllLogs] = useState([]); // for stats\n  const [logsReady, setLogsReady] = useState(false);',
  '  const [allLogs, setAllLogs] = useState([]); // for stats\n  const [logsReady, setLogsReady] = useState(false);\n  const [externalLogRevision, setExternalLogRevision] = useState(0);',
  "App external log revision state"
);
app = replaceOnce(
  app,
  '}, [family?.id, activeProfileId]);\n\n\n// --- Load day log ---',
  '}, [family?.id, activeProfileId, externalLogRevision]);\n\n\n// --- Load day log ---',
  "App all logs reload dependency"
);
app = replaceOnce(
  app,
  '}, [family?.id, activeProfileId, selectedDate, plan]);',
  '}, [family?.id, activeProfileId, selectedDate, plan, externalLogRevision]);',
  "App selected day reload dependency"
);
app = replaceOnce(
  app,
  '                  manualLogId={selectedLogRowId}\n                  blocks={Array.isArray(logForDay?.blocks) && logForDay.blocks.length ? logForDay.blocks : plannedBlocksForSelectedDay}\n                  onOpenProgress={() => setTab("stats")}',
  '                  manualLogId={selectedLogRowId}\n                  blocks={Array.isArray(logForDay?.blocks) && logForDay.blocks.length ? logForDay.blocks : plannedBlocksForSelectedDay}\n                  logJson={logForDay}\n                  onAutoPopulationChanged={() => setExternalLogRevision((value) => value + 1)}\n                  onOpenProgress={() => setTab("stats")}',
  "App LogVerificationSummary auto-population props"
);
fs.writeFileSync(appPath, app);

const reconcilePath = "supabase/functions/_shared/verificationReconcile.ts";
let reconcile = fs.readFileSync(reconcilePath, "utf8");
if (!reconcile.startsWith('import { applyRecentVerifiedAutoPopulationForProfile } from "./verificationAutoPopulate.ts";')) {
  reconcile = 'import { applyRecentVerifiedAutoPopulationForProfile } from "./verificationAutoPopulate.ts";\n\n' + reconcile;
}
reconcile = replaceOnce(
  reconcile,
  '  return {\n    profileId,\n    observationCount:',
  '  const autoPopulation = await applyRecentVerifiedAutoPopulationForProfile(adminClient, profileId);\n\n  return {\n    profileId,\n    observationCount:',
  "reconcile auto population call"
);
reconcile = replaceOnce(
  reconcile,
  '    removedStaleIdentities: staleIds.length,\n    matchVersion: MATCH_VERSION,',
  '    removedStaleIdentities: staleIds.length,\n    matchVersion: MATCH_VERSION,\n    autoPopulation,',
  "reconcile result"
);
fs.writeFileSync(reconcilePath, reconcile);

console.log("Stage 7.3 deterministic finish patch applied.");
