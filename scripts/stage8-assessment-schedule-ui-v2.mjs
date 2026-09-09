import "./stage8-assessment-schedule-ui.mjs";
import fs from "node:fs";

const path = "src/components/assessments/AssessmentHub.test.jsx";
let source = fs.readFileSync(path, "utf8");
const before = '    expect(screen.getByText(/First benchmark week: 21 Sep–27 Sep/)).toBeTruthy();';
const after = '    expect(screen.getByText(/First benchmark week:.*21.*27/)).toBeTruthy();';
const count = source.split(before).length - 1;
if (count !== 1) {
  throw new Error(`locale-neutral date assertion: expected one anchor, found ${count}`);
}
source = source.replace(before, after);
fs.writeFileSync(path, source);
