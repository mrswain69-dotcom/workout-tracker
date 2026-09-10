import fs from "node:fs";

const path = "src/App.jsx";
let source = fs.readFileSync(path, "utf8");

const importNeedle = 'import AssessmentHub from "./components/assessments/AssessmentHub.jsx";';
const importLine = 'import ProgressDashboard from "./components/progress/ProgressDashboard.jsx";';

if (!source.includes(importLine)) {
  if (!source.includes(importNeedle)) {
    throw new Error("Stage 4 patch: AssessmentHub import marker not found");
  }
  source = source.replace(importNeedle, `${importNeedle}\n${importLine}`);
}

const navOld = '{t === "assessments" ? "Assess" : t[0].toUpperCase() + t.slice(1)}';
const navNew = `{t === "assessments"
                ? "Assess"
                : t === "stats"
                ? "Progress"
                : t[0].toUpperCase() + t.slice(1)}`;

if (source.includes(navOld)) {
  source = source.replace(navOld, navNew);
} else if (!source.includes('? "Progress"')) {
  throw new Error("Stage 4 patch: navigation label marker not found");
}

const statsStartMarker = '        {tab === "stats" && (';
const planStartMarker = '\n\n{tab === "plan" && (';
const statsStart = source.indexOf(statsStartMarker);
const statsEnd = source.indexOf(planStartMarker, statsStart);

if (statsStart < 0 || statsEnd < 0) {
  throw new Error("Stage 4 patch: Stats render block boundaries not found");
}

let statsBlock = source.slice(statsStart, statsEnd);

if (!statsBlock.includes("<ProgressDashboard")) {
  const gridNeedle = '<div className="grid2cols">';
  const gridIndex = statsBlock.indexOf(gridNeedle);
  if (gridIndex < 0) {
    throw new Error("Stage 4 patch: legacy Stats grid marker not found");
  }

  const progressShell = `<>
            <ProgressDashboard
              familyId={family?.id}
              profileId={activeProfileId}
              profileName={activeProfile?.name || "Athlete"}
              logs={allLogs}
              currentStreak={stats.streak}
              currentXp={xp}
              referenceDate={getTodayYMD()}
              onOpenAssessments={() => setTab("assessments")}
            />
            <div className="grid2cols progressLegacyStats">`;

  statsBlock =
    statsBlock.slice(0, gridIndex) +
    progressShell +
    statsBlock.slice(gridIndex + gridNeedle.length);

  const closingNeedle = "\n          </div>\n        )}";
  const closingIndex = statsBlock.lastIndexOf(closingNeedle);
  if (closingIndex < 0) {
    throw new Error("Stage 4 patch: legacy Stats closing marker not found");
  }

  const closingReplacement = "\n          </div>\n          </>\n        )}";
  statsBlock =
    statsBlock.slice(0, closingIndex) +
    closingReplacement +
    statsBlock.slice(closingIndex + closingNeedle.length);

  source = source.slice(0, statsStart) + statsBlock + source.slice(statsEnd);
}

const checks = [
  [importLine, "ProgressDashboard import"],
  ['? "Progress"', "Progress navigation label"],
  ["<ProgressDashboard", "Progress dashboard render"],
  ['className="grid2cols progressLegacyStats"', "legacy Stats bridge"],
  ['onOpenAssessments={() => setTab("assessments")}', "Assess navigation bridge"],
];

for (const [needle, label] of checks) {
  if (!source.includes(needle)) {
    throw new Error(`Stage 4 patch validation failed: ${label}`);
  }
}

fs.writeFileSync(path, source);
console.log("Stage 4 Progress UI integration applied and validated.");
