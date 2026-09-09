import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one anchor, found ${count}`);
  return source.replace(before, after);
}

const libraryPath = "src/components/assessments/AssessmentTemplateLibrary.jsx";
let library = fs.readFileSync(libraryPath, "utf8");

library = replaceOnce(
  library,
  `export default function AssessmentTemplateLibrary({
  familyId,
  dbApi = assessmentDb,
  confirmArchive = defaultConfirm,
  onLibraryChange,
}) {`,
  `export default function AssessmentTemplateLibrary({
  familyId,
  dbApi = assessmentDb,
  confirmArchive = defaultConfirm,
  onLibraryChange,
  authorizeMutation = async () => true,
}) {`,
  "library signature"
);

library = replaceOnce(
  library,
  `  const saveTest = async ({ test, developmentTagIds }) => {
    const editorState = testEditor;`,
  `  const saveTest = async ({ test, developmentTagIds }) => {
    if (!(await authorizeMutation("change Assessment Test definitions"))) return;
    const editorState = testEditor;`,
  "saveTest"
);

library = replaceOnce(
  library,
  `    if (!confirmArchive(\`Archive Test “\${test.name}”?\`)) return;
    await perform(async () => {`,
  `    if (!confirmArchive(\`Archive Test “\${test.name}”?\`)) return;
    if (!(await authorizeMutation("archive an Assessment Test"))) return;
    await perform(async () => {`,
  "archiveTest"
);

library = replaceOnce(
  library,
  `  const saveAssessment = async (definition) => {
    const editorState = assessmentEditor;`,
  `  const saveAssessment = async (definition) => {
    if (!(await authorizeMutation("change Assessment definitions"))) return;
    const editorState = assessmentEditor;`,
  "saveAssessment"
);

library = replaceOnce(
  library,
  `  const archiveAssessment = async (template) => {
    if (!confirmArchive(\`Archive Assessment “\${template.name}”?\`)) return;
    await perform(async () => {`,
  `  const archiveAssessment = async (template) => {
    if (!confirmArchive(\`Archive Assessment “\${template.name}”?\`)) return;
    if (!(await authorizeMutation("archive an Assessment"))) return;
    await perform(async () => {`,
  "archiveAssessment"
);

fs.writeFileSync(libraryPath, library);

const appPath = "src/App.jsx";
let app = fs.readFileSync(appPath, "utf8");

const importAnchor = `import SessionLogger from "./components/sessions/SessionLogger.jsx";`;
if (app.includes(`AssessmentTemplateLibrary from "./components/assessments/AssessmentTemplateLibrary.jsx"`)) {
  throw new Error("AssessmentTemplateLibrary import already exists");
}
app = replaceOnce(
  app,
  importAnchor,
  `${importAnchor}\nimport AssessmentTemplateLibrary from "./components/assessments/AssessmentTemplateLibrary.jsx";`,
  "App import"
);

const settingsAnchor = `              <div className="panel mt16">
                <div className="h3">Sign out</div>
                <div className="muted mt8">Use this on shared devices.</div>
                <div className="row mt12">
                  <SecondaryButton onClick={doSignOut}>Sign out</SecondaryButton>
                </div>
              </div>
            </Card>
          </div>
        )}`;

const settingsNext = `              <div className="panel mt16">
                <div className="h3">Sign out</div>
                <div className="muted mt8">Use this on shared devices.</div>
                <div className="row mt12">
                  <SecondaryButton onClick={doSignOut}>Sign out</SecondaryButton>
                </div>
              </div>
            </Card>

            <div className="panel" style={{ gridColumn: "1 / -1" }}>
              <AssessmentTemplateLibrary
                familyId={family?.id || ""}
                authorizeMutation={(reason) => ensureUnlocked(reason)}
              />
            </div>
          </div>
        )}`;

app = replaceOnce(app, settingsAnchor, settingsNext, "Settings panel");
fs.writeFileSync(appPath, app);
