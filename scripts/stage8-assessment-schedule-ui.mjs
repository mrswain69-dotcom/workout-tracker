import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one anchor, found ${count}`);
  return source.replace(before, after);
}

const hubPath = "src/components/assessments/AssessmentHub.jsx";
let hub = fs.readFileSync(hubPath, "utf8");

hub = replaceOnce(
  hub,
`import * as assessmentRunDb from "../../assessmentRunDb.js";\nimport AssessmentRunner from "./AssessmentRunner.jsx";`,
`import * as assessmentRunDb from "../../assessmentRunDb.js";\nimport * as assessmentScheduleDb from "../../assessmentScheduleDb.js";\nimport { buildAssessmentScheduleStatuses } from "../../engine/assessmentScheduleEngine.js";\nimport AssessmentRunner from "./AssessmentRunner.jsx";`,
  "schedule imports"
);

hub = replaceOnce(
  hub,
`const defaultDb = { ...assessmentDefinitionDb, ...assessmentRunDb };`,
`const defaultDb = {\n  ...assessmentDefinitionDb,\n  ...assessmentRunDb,\n  ...assessmentScheduleDb,\n};`,
  "default db"
);

hub = replaceOnce(
  hub,
`function defaultConfirm(message) {\n  if (typeof window === "undefined" || typeof window.confirm !== "function") return true;\n  return window.confirm(message);\n}\n\nconst styles = \``,
`function defaultConfirm(message) {\n  if (typeof window === "undefined" || typeof window.confirm !== "function") return true;\n  return window.confirm(message);\n}\n\nfunction formatScheduleDate(ymd) {\n  const text = cleanText(ymd);\n  if (!text) return "";\n  const date = new Date(\`${"${text}"}T00:00:00\`);\n  if (!Number.isFinite(date.getTime())) return text;\n  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });\n}\n\nfunction scheduleStateLabel(state) {\n  if (state === "due") return "Due this week";\n  if (state === "overdue") return "Overdue";\n  if (state === "completed") return "Completed this cycle";\n  if (state === "in_progress") return "In progress";\n  if (state === "upcoming") return "Upcoming";\n  return "Schedule";\n}\n\nfunction scheduleTimingText(status) {\n  const start = formatScheduleDate(status.cycleStartYmd);\n  const end = formatScheduleDate(status.cycleEndYmd);\n  if (status.state === "completed") {\n    const completed = formatScheduleDate(status.completedRun?.date_ymd || status.completedRun?.dateYmd);\n    return \`Completed ${"${completed}"}. Next benchmark week starts ${"${formatScheduleDate(status.nextCycleStartYmd)}"}.\`;\n  }\n  if (status.state === "in_progress") {\n    return "Assessment in progress — saved results can be resumed without changing the frozen test definition.";\n  }\n  if (status.state === "overdue") {\n    return \`Recommended window was ${"${start}"}–${"${end}"}; complete it before the next cycle when practical.\`;\n  }\n  if (status.state === "upcoming") {\n    return \`First benchmark week: ${"${start}"}–${"${end}"}.\`;\n  }\n  return \`Benchmark week: ${"${start}"}–${"${end}"}.\`;\n}\n\nconst styles = \``,
  "schedule formatters"
);

hub = replaceOnce(
  hub,
`.assessment-hub__card,.assessment-hub__resume{border:1px solid rgba(15,23,42,.12);border-radius:16px;padding:14px;background:#fff}\n.assessment-hub__card h3,.assessment-hub__resume h3{margin:0;font-size:16px}.assessment-hub__card p{font-size:13px;color:#475569}.assessment-hub__meta{font-size:12px;color:#64748b;margin-top:4px}`,
`.assessment-hub__card,.assessment-hub__resume,.assessment-hub__schedule{border:1px solid rgba(15,23,42,.12);border-radius:16px;padding:14px;background:#fff}\n.assessment-hub__card h3,.assessment-hub__resume h3,.assessment-hub__schedule h3{margin:0;font-size:16px}.assessment-hub__card p,.assessment-hub__schedule p{font-size:13px;color:#475569}.assessment-hub__meta{font-size:12px;color:#64748b;margin-top:4px}\n.assessment-hub__schedule{border-width:2px}.assessment-hub__schedule--due{border-color:rgba(255,122,24,.55);background:#fffaf5}.assessment-hub__schedule--overdue{border-color:#f59e0b;background:#fffbeb}.assessment-hub__schedule--completed{border-color:#86efac;background:#f0fdf4}.assessment-hub__schedule--in_progress{border-color:#93c5fd;background:#eff6ff}\n.assessment-hub__schedule-state{display:inline-flex;padding:4px 8px;border-radius:999px;background:#f1f5f9;color:#334155;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}.assessment-hub__schedule ul{margin:8px 0 0;padding-left:18px;color:#475569;font-size:12px}.assessment-hub__schedule li+li{margin-top:4px}`,
  "schedule styles"
);

hub = replaceOnce(
  hub,
`  const [runs, setRuns] = useState([]);\n  const [mode, setMode] = useState("run");`,
`  const [runs, setRuns] = useState([]);\n  const [completedRuns, setCompletedRuns] = useState([]);\n  const [schedules, setSchedules] = useState([]);\n  const [mode, setMode] = useState("run");`,
  "schedule state"
);

hub = replaceOnce(
  hub,
`      setLibrary(emptyAssessmentLibrary());\n      setRuns([]);\n      return;`,
`      setLibrary(emptyAssessmentLibrary());\n      setRuns([]);\n      setCompletedRuns([]);\n      setSchedules([]);\n      return;`,
  "empty refresh state"
);

hub = replaceOnce(
  hub,
`      const [libraryResult, runsResult] = await Promise.all([\n        dbApi.loadAssessmentLibrary(familyId),\n        dbApi.listAssessmentRuns(familyId, {\n          profileId,\n          status: "in_progress",\n          limit: 50,\n        }),\n      ]);`,
`      const [libraryResult, runsResult, completedRunsResult, schedulesResult] = await Promise.all([\n        dbApi.loadAssessmentLibrary(familyId),\n        dbApi.listAssessmentRuns(familyId, {\n          profileId,\n          status: "in_progress",\n          limit: 50,\n        }),\n        dbApi.listAssessmentRuns(familyId, {\n          profileId,\n          status: "completed",\n          limit: 500,\n        }),\n        dbApi.listAssessmentSchedules(familyId, {\n          profileId,\n          activeOnly: true,\n        }),\n      ]);`,
  "refresh requests"
);

hub = replaceOnce(
  hub,
`      const runsError = resultError(\n        runsResult,\n        "Could not load in-progress Assessments"\n      );\n      if (runsError) throw runsError;\n\n      setLibrary(normaliseAssessmentLibrary(libraryResult?.data || {}));\n      setRuns(runsResult?.data || []);`,
`      const runsError = resultError(\n        runsResult,\n        "Could not load in-progress Assessments"\n      );\n      if (runsError) throw runsError;\n      const completedRunsError = resultError(\n        completedRunsResult,\n        "Could not load completed Assessment schedule history"\n      );\n      if (completedRunsError) throw completedRunsError;\n      const schedulesError = resultError(\n        schedulesResult,\n        "Could not load Assessment schedules"\n      );\n      if (schedulesError) throw schedulesError;\n\n      setLibrary(normaliseAssessmentLibrary(libraryResult?.data || {}));\n      setRuns(runsResult?.data || []);\n      setCompletedRuns(completedRunsResult?.data || []);\n      setSchedules(schedulesResult?.data || []);`,
  "refresh results"
);

hub = replaceOnce(
  hub,
`  const templateRows = useMemo(() => {\n    const counts = new Map();\n    for (const row of library.templateTests) {\n      const id = cleanText(row.assessment_template_id || row.assessmentTemplateId);\n      counts.set(id, (counts.get(id) || 0) + 1);\n    }\n    return counts;\n  }, [library.templateTests]);`,
`  const templateRows = useMemo(() => {\n    const counts = new Map();\n    for (const row of library.templateTests) {\n      const id = cleanText(row.assessment_template_id || row.assessmentTemplateId);\n      counts.set(id, (counts.get(id) || 0) + 1);\n    }\n    return counts;\n  }, [library.templateTests]);\n  const templatesById = useMemo(\n    () => new Map(library.templates.map((template) => [cleanText(template.id), template])),\n    [library.templates]\n  );\n  const scheduleStatuses = useMemo(\n    () =>\n      buildAssessmentScheduleStatuses({\n        schedules,\n        runs: [...completedRuns, ...runs],\n        todayYmd,\n      }),\n    [schedules, completedRuns, runs, todayYmd]\n  );`,
  "schedule summaries"
);

hub = replaceOnce(
  hub,
`      {status ? <div role="status" className="assessment-hub__status">{status}</div> : null}\n\n      {runs.length ? (`,
`      {status ? <div role="status" className="assessment-hub__status">{status}</div> : null}\n\n      {scheduleStatuses.length ? (\n        <>\n          <div className="assessment-hub__section-title">Scheduled benchmarks</div>\n          <div className="assessment-hub__grid">\n            {scheduleStatuses.map((scheduleStatus) => {\n              const template = templatesById.get(\n                scheduleStatus.schedule.assessmentTemplateId\n              );\n              if (!template) return null;\n              const guidance = Array.isArray(\n                scheduleStatus.schedule.workflowConfig?.guidance\n              )\n                ? scheduleStatus.schedule.workflowConfig.guidance.filter(Boolean)\n                : [];\n              return (\n                <article\n                  className={\`assessment-hub__schedule assessment-hub__schedule--${"${scheduleStatus.state}"}\`}\n                  key={scheduleStatus.schedule.id}\n                >\n                  <div className="assessment-hub__card-top">\n                    <div>\n                      <div className="assessment-hub__schedule-state">\n                        {scheduleStateLabel(scheduleStatus.state)}\n                      </div>\n                      <h3 style={{ marginTop: 8 }}>{template.name}</h3>\n                      <div className="assessment-hub__meta">\n                        Every {scheduleStatus.schedule.cadenceDays} days · {scheduleStatus.schedule.windowDays}-day benchmark window\n                      </div>\n                    </div>\n                    {scheduleStatus.state === "in_progress" ? (\n                      <button\n                        type="button"\n                        disabled={busy}\n                        onClick={() => resume(scheduleStatus.inProgressRun.id)}\n                      >\n                        Resume\n                      </button>\n                    ) : scheduleStatus.state === "due" ||\n                      scheduleStatus.state === "overdue" ? (\n                      <button\n                        type="button"\n                        disabled={busy || !todayYmd}\n                        onClick={() => start(template.id)}\n                      >\n                        Start scheduled benchmark\n                      </button>\n                    ) : null}\n                  </div>\n                  <p>{scheduleTimingText(scheduleStatus)}</p>\n                  {guidance.length ||\n                  scheduleStatus.schedule.workflowConfig?.allowSplitAcrossDays ? (\n                    <ul>\n                      {guidance.map((item, index) => (\n                        <li key={\`${"${scheduleStatus.schedule.id}"}-guidance-${"${index}"}\`}>\n                          {item}\n                        </li>\n                      ))}\n                      {scheduleStatus.schedule.workflowConfig?.allowSplitAcrossDays ? (\n                        <li>Save progress and resume later if splitting the benchmark gives a cleaner test.</li>\n                      ) : null}\n                    </ul>\n                  ) : null}\n                </article>\n              );\n            })}\n          </div>\n        </>\n      ) : null}\n\n      {runs.length ? (`,
  "scheduled benchmark UI"
);

hub = replaceOnce(
  hub,
`          No active Assessment Templates yet. Stage 7 will seed the shared Football Monthly Benchmark after the generic runner/history path is verified.`,
`          No active Assessment Templates are available for this family.`,
  "post-seed empty state"
);

fs.writeFileSync(hubPath, hub);

const testPath = "src/components/assessments/AssessmentHub.test.jsx";
let test = fs.readFileSync(testPath, "utf8");

test = replaceOnce(
  test,
`function mockDb({ library = definitionLibrary(), runs = [] } = {}) {\n  return {`,
`function mockDb({\n  library = definitionLibrary(),\n  runs = [],\n  completedRuns = [],\n  schedules = [],\n} = {}) {\n  return {`,
  "mock db args"
);

test = replaceOnce(
  test,
`    listAssessmentRuns: vi.fn(async () => ({ data: runs, error: null })),`,
`    listAssessmentRuns: vi.fn(async (_familyId, options = {}) => ({\n      data: options.status === "completed" ? completedRuns : runs,\n      error: null,\n    })),\n    listAssessmentSchedules: vi.fn(async () => ({ data: schedules, error: null })),`,
  "schedule db mocks"
);

test = replaceOnce(
  test,
`    expect(await screen.findByText(/Stage 7 will seed the shared Football Monthly Benchmark/)).toBeTruthy();`,
`    expect(await screen.findByText(/No active Assessment Templates are available/)).toBeTruthy();`,
  "empty state assertion"
);

test = replaceOnce(
  test,
`  it("scopes resumable history to the selected profile", async () => {\n    const db = mockDb();\n    await renderHub(db);\n    expect(db.listAssessmentRuns).toHaveBeenCalledWith("f1", {\n      profileId: "p1",\n      status: "in_progress",\n      limit: 50,\n    });\n  });`,
`  it("scopes resumable, completed and schedule data to the selected profile", async () => {\n    const db = mockDb();\n    await renderHub(db);\n    expect(db.listAssessmentRuns).toHaveBeenCalledWith("f1", {\n      profileId: "p1",\n      status: "in_progress",\n      limit: 50,\n    });\n    expect(db.listAssessmentRuns).toHaveBeenCalledWith("f1", {\n      profileId: "p1",\n      status: "completed",\n      limit: 500,\n    });\n    expect(db.listAssessmentSchedules).toHaveBeenCalledWith("f1", {\n      profileId: "p1",\n      activeOnly: true,\n    });\n  });\n\n  it("shows an upcoming recurring benchmark without creating fake history", async () => {\n    const db = mockDb({\n      schedules: [\n        {\n          id: "schedule-1",\n          family_id: "f1",\n          profile_id: "p1",\n          assessment_template_id: "a1",\n          start_date: "2026-09-21",\n          cadence_days: 28,\n          window_days: 7,\n          workflow_config: {\n            guidance: ["Use repeatable conditions."],\n            allowSplitAcrossDays: true,\n          },\n          active: true,\n        },\n      ],\n    });\n    await renderHub(db);\n    expect(await screen.findByText("Upcoming")).toBeTruthy();\n    expect(screen.getByText(/First benchmark week: 21 Sep–27 Sep/)).toBeTruthy();\n    expect(screen.getByText("Use repeatable conditions.")).toBeTruthy();\n    expect(screen.queryByRole("button", { name: "Start scheduled benchmark" })).toBeNull();\n    expect(db.createAssessmentRun).not.toHaveBeenCalled();\n  });\n\n  it("launches the immutable runner from a due scheduled benchmark", async () => {\n    const db = mockDb({\n      schedules: [\n        {\n          id: "schedule-1",\n          family_id: "f1",\n          profile_id: "p1",\n          assessment_template_id: "a1",\n          start_date: "2026-09-21",\n          cadence_days: 28,\n          window_days: 7,\n          workflow_config: {},\n          active: true,\n        },\n      ],\n    });\n    await renderHub(db, { todayYmd: "2026-09-24" });\n    expect(await screen.findByText("Due this week")).toBeTruthy();\n    fireEvent.click(\n      screen.getByRole("button", { name: "Start scheduled benchmark" })\n    );\n    await waitFor(() => expect(db.createAssessmentRun).toHaveBeenCalledTimes(1));\n    expect(db.createAssessmentRun).toHaveBeenCalledWith(\n      "f1",\n      expect.objectContaining({\n        profileId: "p1",\n        assessmentTemplateId: "a1",\n        dateYmd: "2026-09-24",\n      })\n    );\n  });`,
  "schedule hub tests"
);

fs.writeFileSync(testPath, test);
