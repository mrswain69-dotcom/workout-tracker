import fs from "node:fs";

const path = "src/engine/assessmentMetricEngine.js";
let source = fs.readFileSync(path, "utf8");

const before = `function attemptsSuccessesFrom(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const attempts = Number(value.attempts);
  const successes = Number(value.successes);
`;

const after = `function attemptsSuccessesFrom(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (
    value.attempts === "" ||
    value.attempts === null ||
    value.attempts === undefined ||
    value.successes === "" ||
    value.successes === null ||
    value.successes === undefined
  ) {
    return null;
  }
  const attempts = Number(value.attempts);
  const successes = Number(value.successes);
`;

const count = source.split(before).length - 1;
if (count !== 1) {
  throw new Error(`Expected one attemptsSuccessesFrom anchor, found ${count}`);
}
source = source.replace(before, after);
fs.writeFileSync(path, source);
