import fs from "node:fs";

const path = "src/components/progress/ProgressDashboard.jsx";
let source = fs.readFileSync(path, "utf8");

const importNeedle = 'import { buildProgressViewModel } from "../../engine/progressViewModel.js";\n';
const importReplacement = `${importNeedle}import {\n  AssessmentProgressDetails,\n  DevelopmentTrendDetails,\n} from "./AssessmentDevelopmentProgress.jsx";\n`;
if (!source.includes('from "./AssessmentDevelopmentProgress.jsx"')) {
  if (!source.includes(importNeedle)) throw new Error("Stage 6 import anchor not found");
  source = source.replace(importNeedle, importReplacement);
}

const scheduleNeedle = `        <div\n          className={\`progress-schedule progress-schedule--\${model.assessment.schedule.state}\`}\n        >\n          <div className="progress-schedule__label">Assessment schedule</div>\n          <div className="progress-schedule__title">{model.assessment.schedule.title}</div>\n          <div className="progress-schedule__detail">{model.assessment.schedule.detail}</div>\n        </div>\n`;
const scheduleReplacement = `${scheduleNeedle}\n        <AssessmentProgressDetails assessmentProgress={assessmentProgress} />\n`;
if (!source.includes("<AssessmentProgressDetails assessmentProgress={assessmentProgress} />")) {
  if (!source.includes(scheduleNeedle)) throw new Error("Stage 6 Assessment anchor not found");
  source = source.replace(scheduleNeedle, scheduleReplacement);
}

const oldDevelopmentNote = `          <div className="progress-development-summary__note">\n            Detailed Test charts and Development Trend rows arrive in Stage 6 once\n            benchmark history exists.\n          </div>`;
const newDevelopmentNote = `          <div className="progress-development-summary__note">\n            Direction comes from compatible Assessment history. Strong arrows mean\n            sustained/aligned recent evidence, not a causal training claim.\n          </div>`;
if (source.includes(oldDevelopmentNote)) {
  source = source.replace(oldDevelopmentNote, newDevelopmentNote);
}

const developmentAnchor = `        </div>\n      </div>\n\n      <div className="progress-legacy-bridge">`;
const developmentReplacement = `        </div>\n\n        <DevelopmentTrendDetails developmentTrends={developmentTrends} />\n      </div>\n\n      <div className="progress-legacy-bridge">`;
if (!source.includes("<DevelopmentTrendDetails developmentTrends={developmentTrends} />")) {
  if (!source.includes(developmentAnchor)) throw new Error("Stage 6 Development anchor not found");
  source = source.replace(developmentAnchor, developmentReplacement);
}

fs.writeFileSync(path, source);
