import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one anchor, found ${count}`);
  return source.replace(before, after);
}

const appPath = "src/App.jsx";
let app = fs.readFileSync(appPath, "utf8");

app = replaceOnce(
  app,
  'import AssessmentTemplateLibrary from "./components/assessments/AssessmentTemplateLibrary.jsx";',
  'import AssessmentTemplateLibrary from "./components/assessments/AssessmentTemplateLibrary.jsx";\nimport AssessmentHub from "./components/assessments/AssessmentHub.jsx";',
  "AssessmentHub import"
);

app = replaceOnce(
  app,
  `{["log", "stats", "plan", "rewards"].map((t) => (\n            <SecondaryButton key={t} onClick={() => setTab(t)}>\n              {t[0].toUpperCase() + t.slice(1)}\n            </SecondaryButton>\n          ))}`,
  `{["log", "stats", "plan", "assessments", "rewards"].map((t) => (\n            <SecondaryButton key={t} onClick={() => setTab(t)}>\n              {t === "assessments" ? "Assess" : t[0].toUpperCase() + t.slice(1)}\n            </SecondaryButton>\n          ))}`,
  "main tab strip"
);

app = replaceOnce(
  app,
  `{tab === "rewards" && (`,
  `{tab === "assessments" && (\n  <div className="panel">\n    <AssessmentHub\n      familyId={family?.id || ""}\n      profileId={activeProfileId}\n      athleteName={activeProfile?.name || "Athlete"}\n      todayYmd={todayYmd}\n    />\n  </div>\n)}\n\n{tab === "rewards" && (`,
  "Assessment tab content"
);

fs.writeFileSync(appPath, app);

const stylesPath = "src/styles.css";
let styles = fs.readFileSync(stylesPath, "utf8");
styles = replaceOnce(
  styles,
  `grid-template-columns: repeat(4, minmax(0, 1fr));`,
  `grid-template-columns: repeat(5, minmax(0, 1fr));`,
  "mobile main tab grid"
);
styles = replaceOnce(
  styles,
  `    padding-inline: 8px;\n  }`,
  `    padding-inline: 6px;\n    font-size: 12px;\n  }`,
  "mobile main tab sizing"
);
fs.writeFileSync(stylesPath, styles);
