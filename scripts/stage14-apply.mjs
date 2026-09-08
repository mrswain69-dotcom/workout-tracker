import fs from "node:fs";

function countOf(text, needle) {
  return needle ? text.split(needle).length - 1 : 0;
}

function replaceExact(text, needle, replacement, label, expectedCount = 1) {
  const count = countOf(text, needle);
  if (count !== expectedCount) {
    throw new Error(`${label}: expected ${expectedCount} match(es), found ${count}`);
  }
  return text.split(needle).join(replacement);
}

const historyComponent = String.raw`import React, { useEffect, useMemo, useState } from "react";
import { loadSessionLibrary } from "../../db.js";
import {
  aggregateMovementHistory,
  aggregateSessionHistory,
  getRecommendedNextSession,
  getSessionDistribution,
} from "../../engine/sessionEngine.js";

const DEFAULT_DB_API = Object.freeze({ loadSessionLibrary });

export const SESSION_HISTORY_RANGES = Object.freeze([
  { key: "7d", label: "7d", days: 7 },
  { key: "30d", label: "30d", days: 30 },
  { key: "lifetime", label: "Lifetime", days: null },
]);

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function valueOf(obj, camelKey, snakeKey, fallback = undefined) {
  if (!obj || typeof obj !== "object") return fallback;
  if (obj[camelKey] !== undefined) return obj[camelKey];
  if (snakeKey && obj[snakeKey] !== undefined) return obj[snakeKey];
  return fallback;
}

function templateIdOf(template) {
  return cleanText(template?.id, "");
}

function templateCodeOf(template) {
  return cleanText(valueOf(template, "displayCode", "display_code"), "");
}

function templateNameOf(template) {
  return cleanText(template?.name, "Session");
}

function templateSortOrderOf(template) {
  return Number(valueOf(template, "sortOrder", "sort_order", 0)) || 0;
}

function shiftYmd(ymd, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ""))) return "";
  const date = new Date(String(ymd) + "T00:00:00.000Z");
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function currentYmd() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function getSessionHistoryWindow(rangeKey, endDate) {
  const safeEnd = /^\d{4}-\d{2}-\d{2}$/.test(String(endDate || ""))
    ? String(endDate)
    : currentYmd();
  const range =
    SESSION_HISTORY_RANGES.find((item) => item.key === rangeKey) ||
    SESSION_HISTORY_RANGES[1];

  if (!range.days) {
    return { startDate: "", endDate: safeEnd };
  }

  return {
    startDate: shiftYmd(safeEnd, -(range.days - 1)),
    endDate: safeEnd,
  };
}

export function buildSessionBalanceRows(templates = [], distribution = []) {
  const distributionById = new Map(
    (Array.isArray(distribution) ? distribution : []).map((item) => [
      cleanText(item?.templateId, "unknown"),
      item,
    ])
  );
  const rows = [];
  const seen = new Set();

  for (const template of Array.isArray(templates) ? templates : []) {
    const templateId = templateIdOf(template);
    if (!templateId || seen.has(templateId)) continue;
    seen.add(templateId);
    const history = distributionById.get(templateId) || {};
    rows.push({
      templateId,
      displayCode: templateCodeOf(template) || cleanText(history.displayCode, ""),
      name: templateNameOf(template) || cleanText(history.name, "Session"),
      count: Number(history.count) || 0,
      lastCompletedDate: cleanText(history.lastCompletedDate, ""),
      sortOrder: templateSortOrderOf(template),
      inCurrentPlan: true,
    });
  }

  for (const history of Array.isArray(distribution) ? distribution : []) {
    const templateId = cleanText(history?.templateId, "unknown");
    if (seen.has(templateId)) continue;
    seen.add(templateId);
    rows.push({
      templateId,
      displayCode: cleanText(history?.displayCode, ""),
      name: cleanText(history?.name, "Session"),
      count: Number(history?.count) || 0,
      lastCompletedDate: cleanText(history?.lastCompletedDate, ""),
      sortOrder: Number.MAX_SAFE_INTEGER,
      inCurrentPlan: false,
    });
  }

  return rows.sort((a, b) => {
    if (a.inCurrentPlan !== b.inCurrentPlan) return a.inCurrentPlan ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return (a.displayCode + "|" + a.name).localeCompare(b.displayCode + "|" + b.name);
  });
}

function formatTemplateName(code, name) {
  const safeCode = cleanText(code, "");
  const safeName = cleanText(name, "Session");
  return safeCode ? "Session " + safeCode + " — " + safeName : safeName;
}

function formatDateLabel(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ""))) return "";
  const date = new Date(String(ymd) + "T00:00:00");
  if (Number.isNaN(date.getTime())) return String(ymd);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatMinutes(value) {
  const total = Math.max(0, Math.round(Number(value) || 0));
  if (!total) return "0m";
  if (total < 60) return total + "m";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes ? hours + "h " + minutes + "m" : hours + "h";
}

function plural(value, singular, pluralForm) {
  return Number(value) === 1 ? singular : pluralForm;
}

export default function SessionHistory({
  familyId,
  logs = [],
  templateIds = null,
  endDate = "",
  dbApi = DEFAULT_DB_API,
  className = "",
}) {
  const [rangeKey, setRangeKey] = useState("30d");
  const [library, setLibrary] = useState({ templates: [] });
  const [loading, setLoading] = useState(false);
  const [libraryError, setLibraryError] = useState("");

  const effectiveEndDate = /^\d{4}-\d{2}-\d{2}$/.test(String(endDate || ""))
    ? String(endDate)
    : currentYmd();

  const lifetimeSummary = useMemo(
    () => aggregateSessionHistory(logs, { endDate: effectiveEndDate }),
    [logs, effectiveEndDate]
  );

  const hasLifetimeHistory =
    lifetimeSummary.completedSessions > 0 || lifetimeSummary.partialSessions > 0;

  const explicitTemplateFilter = Array.isArray(templateIds);
  const requestedTemplateIds = useMemo(
    () =>
      new Set(
        (Array.isArray(templateIds) ? templateIds : [])
          .map((value) => cleanText(value, ""))
          .filter(Boolean)
      ),
    [templateIds]
  );

  const shouldLoadLibrary =
    !!familyId &&
    (!explicitTemplateFilter || requestedTemplateIds.size > 0 || hasLifetimeHistory);

  useEffect(() => {
    let active = true;

    if (!shouldLoadLibrary) {
      setLibrary({ templates: [] });
      setLoading(false);
      setLibraryError("");
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setLibraryError("");

    Promise.resolve(
      dbApi.loadSessionLibrary(familyId, { includeArchived: true })
    )
      .then((result) => {
        if (!active) return;
        if (result?.error) {
          setLibrary({ templates: [] });
          setLibraryError(
            cleanText(result.error?.message, "Session library could not be loaded.")
          );
          return;
        }
        setLibrary(
          result?.data && typeof result.data === "object"
            ? result.data
            : { templates: [] }
        );
      })
      .catch((error) => {
        if (!active) return;
        setLibrary({ templates: [] });
        setLibraryError(
          cleanText(error?.message, "Session library could not be loaded.")
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dbApi, familyId, shouldLoadLibrary]);

  const historyWindow = useMemo(
    () => getSessionHistoryWindow(rangeKey, effectiveEndDate),
    [rangeKey, effectiveEndDate]
  );

  const summary = useMemo(
    () => aggregateSessionHistory(logs, historyWindow),
    [logs, historyWindow]
  );

  const movementHistory = useMemo(
    () => aggregateMovementHistory(logs, historyWindow),
    [logs, historyWindow]
  );

  const distribution = useMemo(
    () => getSessionDistribution(logs, historyWindow),
    [logs, historyWindow]
  );

  const allTemplates = Array.isArray(library?.templates)
    ? library.templates
    : [];

  const eligibleTemplates = useMemo(
    () =>
      allTemplates.filter((template) => {
        if (valueOf(template, "archived", "archived", false)) return false;
        if (!explicitTemplateFilter) return true;
        return requestedTemplateIds.has(templateIdOf(template));
      }),
    [allTemplates, explicitTemplateFilter, requestedTemplateIds]
  );

  const balanceRows = useMemo(
    () => buildSessionBalanceRows(eligibleTemplates, distribution),
    [eligibleTemplates, distribution]
  );

  const recommendation = useMemo(
    () =>
      getRecommendedNextSession({
        templates: eligibleTemplates,
        logs,
        days: 28,
        endDate: effectiveEndDate,
      }),
    [eligibleTemplates, logs, effectiveEndDate]
  );

  const hasPlannedSessions = eligibleTemplates.length > 0;
  const explicitEmptyPlan = explicitTemplateFilter && requestedTemplateIds.size === 0;

  if (!hasLifetimeHistory && explicitEmptyPlan) return null;
  if (!hasLifetimeHistory && !hasPlannedSessions && !loading && !libraryError) {
    return null;
  }

  const maxBalanceCount = Math.max(
    1,
    ...balanceRows.map((row) => Number(row.count) || 0)
  );

  const rootClass = ["panel", "mt16", "session-history", className]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={rootClass} data-testid="session-history">
      <div className="session-history__header">
        <div>
          <div className="h2">Session progress</div>
          <div className="muted mini mt4">
            Session completions are kept separate from drill volume and results.
          </div>
        </div>

        <div className="session-history__ranges" aria-label="Session history range">
          {SESSION_HISTORY_RANGES.map((range) => (
            <button
              key={range.key}
              type="button"
              className={
                "session-history__range" +
                (rangeKey === range.key ? " session-history__range--active" : "")
              }
              aria-pressed={rangeKey === range.key}
              onClick={() => setRangeKey(range.key)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="session-history__notice muted mini mt8">
          Refreshing Session balance…
        </div>
      ) : null}

      {libraryError ? (
        <div className="session-history__notice session-history__notice--warning mt8">
          Session history is available, but the current-plan balance and recommendation
          could not be refreshed right now.
        </div>
      ) : null}

      {recommendation ? (
        <div
          className="session-history__recommendation mt12"
          data-testid="session-history-recommendation"
        >
          <div className="session-history__recommendation-eyebrow">
            Recommended next · 28-day balance
          </div>
          <div className="session-history__recommendation-title">
            {formatTemplateName(recommendation.displayCode, recommendation.name)}
          </div>
          <div className="session-history__recommendation-meta">
            {recommendation.completedInWindow} completed in the last 28 days
            {recommendation.lastCompletedDate
              ? " · Last completed " + formatDateLabel(recommendation.lastCompletedDate)
              : " · Not yet completed in this window"}
          </div>
          <div className="session-history__recommendation-reason">
            {recommendation.reason}
          </div>
        </div>
      ) : null}

      <div className="session-history__metrics mt12">
        <div className="session-history__metric" data-testid="session-history-completed">
          <span>Completed</span>
          <strong>{summary.completedSessions}</strong>
        </div>
        <div className="session-history__metric" data-testid="session-history-partial">
          <span>Partial</span>
          <strong>{summary.partialSessions}</strong>
        </div>
        <div className="session-history__metric" data-testid="session-history-minutes">
          <span>Training time</span>
          <strong>{formatMinutes(summary.totalMinutes)}</strong>
        </div>
        <div className="session-history__metric" data-testid="session-history-executions">
          <span>Recorded executions</span>
          <strong>{summary.recordedExecutions}</strong>
        </div>
        <div className="session-history__metric" data-testid="session-history-accuracy">
          <span>Accuracy</span>
          <strong>{summary.accuracyPct === null ? "—" : summary.accuracyPct + "%"}</strong>
        </div>
      </div>

      <div className="session-history__section mt16">
        <div className="row between session-history__section-heading">
          <div>
            <div className="h3">Session balance</div>
            <div className="muted mini mt4">
              Completed Sessions only. Partial practice does not inflate the balance.
            </div>
          </div>
        </div>

        {balanceRows.length ? (
          <div className="session-history__balance-list mt8">
            {balanceRows.map((row) => {
              const pct = Math.round(((Number(row.count) || 0) / maxBalanceCount) * 100);
              return (
                <div
                  key={row.templateId}
                  className="session-history__balance-row"
                  data-testid={"session-balance-" + row.templateId}
                >
                  <div className="session-history__balance-top">
                    <div>
                      <strong>{formatTemplateName(row.displayCode, row.name)}</strong>
                      <span className="session-history__balance-chip">
                        {row.inCurrentPlan ? "In plan" : "History"}
                      </span>
                    </div>
                    <div className="session-history__balance-count">
                      {row.count} {plural(row.count, "completion", "completions")}
                    </div>
                  </div>
                  <div className="session-history__bar" aria-hidden="true">
                    <span style={{ width: pct + "%" }} />
                  </div>
                  <div className="muted mini mt4">
                    {row.lastCompletedDate
                      ? "Last completed " + formatDateLabel(row.lastCompletedDate)
                      : "No completion in this range"}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="muted mini mt8">
            No completed Session history in this range.
          </div>
        )}
      </div>

      <details className="session-history__movements mt16" open>
        <summary>
          Movement volume &amp; results ({movementHistory.length})
        </summary>
        <div className="muted mini mt4">
          A Session can be completed without detailed counts, so these numbers are
          supporting practice data rather than the Session completion total.
        </div>

        {movementHistory.length ? (
          <div className="session-history__movement-list mt8">
            {movementHistory.map((movement) => (
              <div
                key={movement.movementId}
                className="session-history__movement-row"
                data-testid={"session-movement-" + movement.movementId}
              >
                <div className="session-history__movement-title">
                  <strong>{movement.name}</strong>
                  <span>
                    {movement.timesPerformed} {plural(movement.timesPerformed, "practice", "practices")}
                  </span>
                </div>
                <div className="session-history__movement-stats">
                  {movement.recordedExecutions > 0 ? (
                    <span>{movement.recordedExecutions} recorded executions</span>
                  ) : null}
                  {movement.attempts > 0 ? (
                    <span>
                      {movement.successes} / {movement.attempts} successful
                      {movement.accuracyPct === null ? "" : " · " + movement.accuracyPct + "% accuracy"}
                    </span>
                  ) : null}
                  {movement.bestScore !== null ? (
                    <span>Best {movement.bestScore}</span>
                  ) : null}
                  {movement.lastPerformedDate ? (
                    <span>Last {formatDateLabel(movement.lastPerformedDate)}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted mini mt8">
            No drill-level practice data in this range.
          </div>
        )}
      </details>
    </section>
  );
}
`;

const historyTests = String.raw`import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SessionHistory, {
  buildSessionBalanceRows,
  getSessionHistoryWindow,
} from "./SessionHistory.jsx";

function makeLibrary() {
  return {
    templates: [
      {
        id: "session-a",
        display_code: "A",
        name: "Close Control",
        sort_order: 1,
        archived: false,
      },
      {
        id: "session-b",
        display_code: "B",
        name: "First Touch & Protection",
        sort_order: 2,
        archived: false,
      },
      {
        id: "session-c",
        display_code: "C",
        name: "Direction & Weak Foot",
        sort_order: 3,
        archived: false,
      },
    ],
  };
}

function makeMovement({
  id,
  name,
  method = "repetitions",
  result = null,
  completed = true,
}) {
  return {
    templateMovementId: "tm-" + id,
    movementId: id,
    name,
    displayLabel: name,
    trackingMethod: method,
    trackingConfig: {},
    completed,
    skipped: false,
    result,
  };
}

function makeSession({
  templateId,
  code,
  name,
  completed = true,
  actualDurationSec = 900,
  movements = [],
}) {
  return {
    schemaVersion: 1,
    programmeId: "programme-football",
    templateId,
    templateVersion: 1,
    displayCode: code,
    name,
    plannedDurationSec: 900,
    actualDurationSec,
    completed,
    movements,
  };
}

function makeRow(date, session) {
  return {
    date_ymd: date,
    log: {
      date_ymd: date,
      blocks: [
        {
          id: "block-" + date + "-" + session.templateId,
          typeId: "session",
          session,
        },
      ],
    },
  };
}

function makeDbApi(library = makeLibrary()) {
  return {
    loadSessionLibrary: vi.fn().mockResolvedValue({ data: library, error: null }),
  };
}

describe("Session history helpers", () => {
  it("builds inclusive 7-day, 30-day and lifetime windows", () => {
    expect(getSessionHistoryWindow("7d", "2026-09-08")).toEqual({
      startDate: "2026-09-02",
      endDate: "2026-09-08",
    });
    expect(getSessionHistoryWindow("30d", "2026-09-08")).toEqual({
      startDate: "2026-08-10",
      endDate: "2026-09-08",
    });
    expect(getSessionHistoryWindow("lifetime", "2026-09-08")).toEqual({
      startDate: "",
      endDate: "2026-09-08",
    });
  });

  it("keeps zero-completion current-plan Sessions in the balance", () => {
    const rows = buildSessionBalanceRows(makeLibrary().templates.slice(0, 2), [
      {
        templateId: "session-a",
        displayCode: "A",
        name: "Close Control",
        count: 2,
        lastCompletedDate: "2026-09-05",
      },
      {
        templateId: "old-session",
        displayCode: "OLD",
        name: "Historical Session",
        count: 1,
        lastCompletedDate: "2026-08-01",
      },
    ]);

    expect(rows.map((row) => row.templateId)).toEqual([
      "session-a",
      "session-b",
      "old-session",
    ]);
    expect(rows[1].count).toBe(0);
    expect(rows[1].inCurrentPlan).toBe(true);
    expect(rows[2].inCurrentPlan).toBe(false);
  });
});

describe("SessionHistory", () => {
  it("shows 30-day completion history separately from partial practice and drill results", async () => {
    const logs = [
      makeRow(
        "2026-09-01",
        makeSession({
          templateId: "session-a",
          code: "A",
          name: "Close Control",
          movements: [
            makeMovement({
              id: "sole-rolls",
              name: "Sole Rolls",
              result: { overall: { count: 20 } },
            }),
          ],
        })
      ),
      makeRow(
        "2026-09-02",
        makeSession({
          templateId: "session-b",
          code: "B",
          name: "First Touch & Protection",
          completed: false,
          actualDurationSec: 300,
          movements: [
            makeMovement({
              id: "first-touch",
              name: "First Touch",
              method: "attempts_successes",
              result: { overall: { attempts: 10, successes: 8 } },
            }),
          ],
        })
      ),
      makeRow(
        "2026-07-01",
        makeSession({
          templateId: "session-a",
          code: "A",
          name: "Close Control",
        })
      ),
    ];

    render(
      <SessionHistory
        familyId="family-1"
        logs={logs}
        templateIds={["session-a", "session-b", "session-c"]}
        endDate="2026-09-08"
        dbApi={makeDbApi()}
      />
    );

    expect(within(screen.getByTestId("session-history-completed")).getByText("1")).toBeTruthy();
    expect(within(screen.getByTestId("session-history-partial")).getByText("1")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId("session-balance-session-b").textContent).toContain(
        "0 completions"
      );
    });

    expect(screen.getByTestId("session-movement-sole-rolls").textContent).toContain(
      "20 recorded executions"
    );
    expect(screen.getByText(/Session completions are kept separate/i)).toBeTruthy();
  });

  it("switches between 7d, 30d and Lifetime without changing the underlying logs", async () => {
    const logs = [
      makeRow(
        "2026-09-05",
        makeSession({ templateId: "session-a", code: "A", name: "Close Control" })
      ),
      makeRow(
        "2026-08-20",
        makeSession({ templateId: "session-b", code: "B", name: "First Touch & Protection" })
      ),
      makeRow(
        "2026-07-01",
        makeSession({ templateId: "session-c", code: "C", name: "Direction & Weak Foot" })
      ),
    ];

    render(
      <SessionHistory
        familyId="family-1"
        logs={logs}
        templateIds={["session-a", "session-b", "session-c"]}
        endDate="2026-09-08"
        dbApi={makeDbApi()}
      />
    );

    expect(within(screen.getByTestId("session-history-completed")).getByText("2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "7d" }));
    expect(within(screen.getByTestId("session-history-completed")).getByText("1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Lifetime" }));
    expect(within(screen.getByTestId("session-history-completed")).getByText("3")).toBeTruthy();
  });

  it("recommends only among Sessions in the current profile plan", async () => {
    const logs = [
      makeRow(
        "2026-09-05",
        makeSession({ templateId: "session-a", code: "A", name: "Close Control" })
      ),
      makeRow(
        "2026-08-25",
        makeSession({ templateId: "session-b", code: "B", name: "First Touch & Protection" })
      ),
    ];

    render(
      <SessionHistory
        familyId="family-1"
        logs={logs}
        templateIds={["session-a", "session-b"]}
        endDate="2026-09-08"
        dbApi={makeDbApi()}
      />
    );

    const card = await screen.findByTestId("session-history-recommendation");
    expect(card.textContent).toContain("Session B — First Touch & Protection");
    expect(card.textContent).not.toContain("Session C");
    expect(card.textContent).toContain("Last completed 25 Aug");
  });

  it("shows attempts/successes, accuracy and best-score movement results", () => {
    const logs = [
      makeRow(
        "2026-09-05",
        makeSession({
          templateId: "session-b",
          code: "B",
          name: "First Touch & Protection",
          movements: [
            makeMovement({
              id: "first-touch",
              name: "First Touch",
              method: "attempts_successes",
              result: { overall: { attempts: 10, successes: 8 } },
            }),
            makeMovement({
              id: "keepy-ups",
              name: "Weak-Foot Keepy-Uppys",
              method: "best_score",
              result: { overall: { best: 24 } },
            }),
          ],
        })
      ),
    ];

    render(
      <SessionHistory
        familyId="family-1"
        logs={logs}
        templateIds={["session-b"]}
        endDate="2026-09-08"
        dbApi={makeDbApi()}
      />
    );

    expect(screen.getByTestId("session-movement-first-touch").textContent).toContain(
      "8 / 10 successful · 80% accuracy"
    );
    expect(screen.getByTestId("session-movement-keepy-ups").textContent).toContain(
      "Best 24"
    );
  });

  it("keeps historical Session data visible if the live library refresh fails", async () => {
    const dbApi = {
      loadSessionLibrary: vi.fn().mockResolvedValue({
        data: null,
        error: new Error("offline"),
      }),
    };
    const logs = [
      makeRow(
        "2026-09-05",
        makeSession({ templateId: "session-a", code: "A", name: "Close Control" })
      ),
    ];

    render(
      <SessionHistory
        familyId="family-1"
        logs={logs}
        templateIds={["session-a"]}
        endDate="2026-09-08"
        dbApi={dbApi}
      />
    );

    expect(screen.getByTestId("session-history")).toBeTruthy();
    await screen.findByText(/Session history is available/i);
    expect(within(screen.getByTestId("session-history-completed")).getByText("1")).toBeTruthy();
  });

  it("does not add an empty Session progress panel when the current plan has no Sessions and there is no history", () => {
    render(
      <SessionHistory
        familyId="family-1"
        logs={[]}
        templateIds={[]}
        endDate="2026-09-08"
        dbApi={makeDbApi()}
      />
    );

    expect(screen.queryByTestId("session-history")).toBeNull();
  });
});
`;

fs.mkdirSync("src/components/sessions", { recursive: true });
fs.writeFileSync("src/components/sessions/SessionHistory.jsx", historyComponent, "utf8");
fs.writeFileSync("src/components/sessions/SessionHistory.test.jsx", historyTests, "utf8");

const enginePath = "src/engine/sessionEngine.js";
let engine = fs.readFileSync(enginePath, "utf8");

engine = replaceExact(
  engine,
  `function getLogPayload(logOrRow) {\n  if (!logOrRow || typeof logOrRow !== "object") return null;\n  if (logOrRow.log_json && typeof logOrRow.log_json === "object") {\n    return logOrRow.log_json;\n  }\n  return logOrRow;\n}`,
  `function getLogPayload(logOrRow) {\n  if (!logOrRow || typeof logOrRow !== "object") return null;\n  if (logOrRow.log_json && typeof logOrRow.log_json === "object") {\n    return logOrRow.log_json;\n  }\n  if (logOrRow.log && typeof logOrRow.log === "object") {\n    return logOrRow.log;\n  }\n  return logOrRow;\n}`,
  "App log-row Session history compatibility"
);

engine = replaceExact(
  engine,
  `  const distribution = getSessionDistribution(logs, { startDate, endDate });\n  const counts = new Map(distribution.map((item) => [item.templateId, item.count]));`,
  `  const distribution = getSessionDistribution(logs, { startDate, endDate });\n  const counts = new Map(distribution.map((item) => [item.templateId, item.count]));\n  const lastCompletedDates = new Map(\n    distribution.map((item) => [item.templateId, item.lastCompletedDate || ""])\n  );`,
  "Recommendation last-completed index"
);

engine = replaceExact(
  engine,
  `  let selected = candidates[0];\n  let selectedCount = counts.get(selected.templateId) || 0;\n  for (const candidate of candidates.slice(1)) {\n    const count = counts.get(candidate.templateId) || 0;\n    if (count < selectedCount) {\n      selected = candidate;\n      selectedCount = count;\n    }\n  }\n\n  return {\n    templateId: selected.templateId,\n    displayCode: selected.displayCode,\n    name: selected.name,\n    completedInWindow: selectedCount,\n    windowDays,\n    startDate,\n    endDate,\n    reason: "You have completed this session least often recently.",\n  };`,
  `  let selected = candidates[0];\n  let selectedCount = counts.get(selected.templateId) || 0;\n  let selectedLastCompletedDate =\n    lastCompletedDates.get(selected.templateId) || "";\n\n  for (const candidate of candidates.slice(1)) {\n    const count = counts.get(candidate.templateId) || 0;\n    const lastCompletedDate =\n      lastCompletedDates.get(candidate.templateId) || "";\n\n    const isLessCompleted = count < selectedCount;\n    const isOlderEqualCount =\n      count === selectedCount &&\n      ((lastCompletedDate === "" && selectedLastCompletedDate !== "") ||\n        (lastCompletedDate !== "" &&\n          selectedLastCompletedDate !== "" &&\n          lastCompletedDate < selectedLastCompletedDate));\n\n    if (isLessCompleted || isOlderEqualCount) {\n      selected = candidate;\n      selectedCount = count;\n      selectedLastCompletedDate = lastCompletedDate;\n    }\n  }\n\n  return {\n    templateId: selected.templateId,\n    displayCode: selected.displayCode,\n    name: selected.name,\n    completedInWindow: selectedCount,\n    lastCompletedDate: selectedLastCompletedDate,\n    windowDays,\n    startDate,\n    endDate,\n    reason:\n      "You have completed this session least often recently; ties favour the one you did least recently.",\n  };`,
  "Recommendation least-recent tie break"
);

fs.writeFileSync(enginePath, engine, "utf8");

const engineTestPath = "src/engine/sessionEngine.test.js";
let engineTests = fs.readFileSync(engineTestPath, "utf8");

engineTests = replaceExact(
  engineTests,
  `describe("Session balance and recommendation", () => {`,
  `describe("App log-row compatibility", () => {\n  it("aggregates the app's date_ymd + log history row shape", () => {\n    const library = makeLibrary();\n    const session = snapshotFor("session-a", library);\n    session.completed = true;\n    const canonical = makeLog("2026-09-05", session);\n\n    const history = aggregateSessionHistory([\n      { date_ymd: canonical.date_ymd, log: canonical.log_json },\n    ]);\n\n    expect(history.completedSessions).toBe(1);\n    expect(history.byTemplate[0].templateId).toBe("session-a");\n  });\n});\n\ndescribe("Session balance and recommendation", () => {`,
  "App log-row compatibility test"
);

engineTests = replaceExact(
  engineTests,
  `  it("uses template order as the stable tie-break when no Session has history", () => {`,
  `  it("uses the least-recent completion to break equal recent counts", () => {\n    const library = makeLibrary();\n    const a = snapshotFor("session-a", library);\n    const b = snapshotFor("session-b", library);\n    a.completed = true;\n    b.completed = true;\n\n    const recommendation = getRecommendedNextSession({\n      templates: library.templates.slice(0, 2),\n      logs: [\n        makeLog("2026-09-05", a),\n        makeLog("2026-08-25", b),\n      ],\n      days: 28,\n      endDate: "2026-09-08",\n    });\n\n    expect(recommendation.templateId).toBe("session-b");\n    expect(recommendation.completedInWindow).toBe(1);\n    expect(recommendation.lastCompletedDate).toBe("2026-08-25");\n  });\n\n  it("uses template order as the stable tie-break when no Session has history", () => {`,
  "Recommendation tie-break test"
);

fs.writeFileSync(engineTestPath, engineTests, "utf8");

const appPath = "src/App.jsx";
let app = fs.readFileSync(appPath, "utf8");

app = replaceExact(
  app,
  `import SessionLogger from "./components/sessions/SessionLogger.jsx";`,
  `import SessionLogger from "./components/sessions/SessionLogger.jsx";\nimport SessionHistory from "./components/sessions/SessionHistory.jsx";`,
  "SessionHistory App import"
);

app = replaceExact(
  app,
  `  const blocksForSelectedPlanDay = useMemo(() => {\n    if (!plan) return [];\n    return getBlocksForPlanWeekday(plan, planWeekday) || [];\n  }, [plan, planWeekday]);\n\n  function makeLogCacheKey`,
  `  const blocksForSelectedPlanDay = useMemo(() => {\n    if (!plan) return [];\n    return getBlocksForPlanWeekday(plan, planWeekday) || [];\n  }, [plan, planWeekday]);\n\n  // Recommendations must only consider Session templates that are actually\n  // assigned somewhere in this profile's current weekly plan. The Session\n  // Library is family-owned, so using every family template here could suggest\n  // a Session that belongs to another person's programme.\n  const plannedSessionTemplateIds = useMemo(() => {\n    if (!plan) return [];\n    const ids = new Set();\n    for (const weekday of WEEKDAYS) {\n      const blocks = getBlocksForPlanWeekday(plan, weekday) || [];\n      for (const block of blocks) {\n        if (!block || block.typeId !== "session") continue;\n        const templateId = String(\n          block.sessionTemplateId || block.session_template_id || ""\n        ).trim();\n        if (templateId) ids.add(templateId);\n      }\n    }\n    return Array.from(ids);\n  }, [plan]);\n\n  function makeLogCacheKey`,
  "Current-plan Session template IDs"
);

app = replaceExact(
  app,
  `{/* Structured Session blocks log */}\n{hasAnySessionBlocks && (`,
  `<SessionHistory\n  familyId={family?.id}\n  logs={allLogs}\n  templateIds={plannedSessionTemplateIds}\n  endDate={todayYmd}\n/>\n\n{/* Structured Session blocks log */}\n{hasAnySessionBlocks && (`,
  "Session history Log-tab panel"
);

fs.writeFileSync(appPath, app, "utf8");

const stylesPath = "src/styles.css";
let styles = fs.readFileSync(stylesPath, "utf8");
const styleMarker = "/* === Stage 14: Session history, balance & recommendation === */";
if (!styles.includes(styleMarker)) {
  styles += String.raw`

/* === Stage 14: Session history, balance & recommendation === */
.session-history{
  overflow:hidden;
}
.session-history__header{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  flex-wrap:wrap;
}
.session-history__ranges{
  display:flex;
  gap:6px;
  flex-wrap:wrap;
}
.session-history__range{
  border:1px solid #dbe3ec;
  background:#fff;
  color:#475569;
  border-radius:999px;
  padding:6px 10px;
  font-size:12px;
  font-weight:800;
  cursor:pointer;
}
.session-history__range--active{
  border-color:var(--brand);
  background:var(--brand);
  color:#fff;
}
.session-history__notice{
  padding:8px 10px;
  border-radius:10px;
  background:#f8fafc;
  border:1px solid #e2e8f0;
}
.session-history__notice--warning{
  color:#9a3412;
  background:#fff7ed;
  border-color:#fed7aa;
}
.session-history__recommendation{
  border:1px solid rgba(255,122,24,.3);
  background:linear-gradient(135deg, rgba(255,122,24,.12), rgba(255,154,77,.06));
  border-radius:14px;
  padding:13px 14px;
}
.session-history__recommendation-eyebrow{
  color:var(--brand-dark);
  font-size:11px;
  font-weight:900;
  letter-spacing:.06em;
  text-transform:uppercase;
}
.session-history__recommendation-title{
  margin-top:4px;
  font-size:18px;
  line-height:1.2;
  font-weight:900;
  color:#0f172a;
}
.session-history__recommendation-meta,
.session-history__recommendation-reason{
  margin-top:5px;
  font-size:12px;
  color:#475569;
}
.session-history__metrics{
  display:grid;
  grid-template-columns:repeat(5, minmax(0, 1fr));
  gap:8px;
}
.session-history__metric{
  min-width:0;
  border:1px solid #e2e8f0;
  border-radius:12px;
  background:#fff;
  padding:10px;
}
.session-history__metric span{
  display:block;
  color:#64748b;
  font-size:11px;
  font-weight:700;
}
.session-history__metric strong{
  display:block;
  margin-top:3px;
  font-size:19px;
  line-height:1;
  color:#0f172a;
}
.session-history__section{
  border-top:1px solid #eef2f7;
  padding-top:14px;
}
.session-history__section-heading{
  align-items:flex-start;
}
.session-history__balance-list{
  display:grid;
  gap:9px;
}
.session-history__balance-row{
  border:1px solid #e2e8f0;
  border-radius:12px;
  padding:10px 11px;
  background:#fff;
}
.session-history__balance-top{
  display:flex;
  justify-content:space-between;
  gap:10px;
  align-items:flex-start;
}
.session-history__balance-top > div:first-child{
  min-width:0;
}
.session-history__balance-chip{
  display:inline-block;
  margin-left:7px;
  padding:2px 6px;
  border-radius:999px;
  background:#f1f5f9;
  color:#64748b;
  font-size:10px;
  font-weight:800;
  vertical-align:1px;
}
.session-history__balance-count{
  flex:0 0 auto;
  color:#475569;
  font-size:12px;
  font-weight:800;
}
.session-history__bar{
  height:6px;
  margin-top:8px;
  border-radius:999px;
  overflow:hidden;
  background:#f1f5f9;
}
.session-history__bar span{
  display:block;
  height:100%;
  min-width:0;
  border-radius:inherit;
  background:linear-gradient(90deg, var(--brand), var(--brand-2));
}
.session-history__movements{
  border-top:1px solid #eef2f7;
  padding-top:14px;
}
.session-history__movements > summary{
  cursor:pointer;
  font-size:15px;
  font-weight:900;
  color:#0f172a;
}
.session-history__movement-list{
  display:grid;
  gap:8px;
}
.session-history__movement-row{
  display:flex;
  justify-content:space-between;
  gap:12px;
  align-items:flex-start;
  border:1px solid #e2e8f0;
  border-radius:11px;
  background:#fff;
  padding:9px 10px;
}
.session-history__movement-title{
  min-width:0;
}
.session-history__movement-title strong,
.session-history__movement-title span{
  display:block;
}
.session-history__movement-title span{
  margin-top:3px;
  color:#64748b;
  font-size:11px;
}
.session-history__movement-stats{
  display:flex;
  justify-content:flex-end;
  gap:6px;
  flex-wrap:wrap;
  text-align:right;
}
.session-history__movement-stats span{
  display:inline-block;
  padding:3px 6px;
  border-radius:8px;
  background:#f8fafc;
  color:#475569;
  font-size:11px;
  font-weight:700;
}
@media (max-width: 800px){
  .session-history__metrics{
    grid-template-columns:repeat(2, minmax(0, 1fr));
  }
  .session-history__metric:last-child{
    grid-column:1 / -1;
  }
}
@media (max-width: 560px){
  .session-history__header{
    display:block;
  }
  .session-history__ranges{
    margin-top:10px;
  }
  .session-history__balance-top,
  .session-history__movement-row{
    display:block;
  }
  .session-history__balance-count{
    margin-top:5px;
  }
  .session-history__movement-stats{
    justify-content:flex-start;
    text-align:left;
    margin-top:7px;
  }
}
`;
}
fs.writeFileSync(stylesPath, styles, "utf8");

console.log("Stage 14 Session history patch applied.");
