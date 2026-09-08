import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as workoutDb from "../../db.js";
import SessionTemplateEditor from "./SessionTemplateEditor.jsx";
import {
  activeSessionsInProgramme,
  activeSessionsUsingMovement,
  emptySessionLibrary,
  getProgrammeSessions,
  getTemplateDefinition,
  normaliseSessionLibrary,
  persistSessionDefinition,
} from "./sessionLibraryController.js";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function resultError(result, fallback) {
  if (!result?.error) return null;
  const message = result.error?.message || String(result.error);
  return new Error(`${fallback}: ${message}`);
}

async function expectMutation(promise, fallback) {
  const result = await promise;
  const error = resultError(result, fallback);
  if (error) throw error;
  return result?.data || null;
}

function defaultConfirm(message) {
  if (typeof window === "undefined" || typeof window.confirm !== "function") return true;
  return window.confirm(message);
}

function ProgrammeForm({ value, onSave, onCancel, saving = false }) {
  const [draft, setDraft] = useState({
    id: cleanText(value?.id),
    name: cleanText(value?.name),
    category: cleanText(value?.category),
    description: cleanText(value?.description),
  });

  useEffect(() => {
    setDraft({
      id: cleanText(value?.id),
      name: cleanText(value?.name),
      category: cleanText(value?.category),
      description: cleanText(value?.description),
    });
  }, [value]);

  const valid = !!cleanText(draft.name);

  return (
    <form
      className="session-library__programme-form"
      aria-label={draft.id ? "Edit programme" : "New programme"}
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid || saving) return;
        onSave?.({ ...draft, name: cleanText(draft.name) });
      }}
    >
      <label>
        <span>Name</span>
        <input
          aria-label="Programme name"
          value={draft.name}
          disabled={saving}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
        />
      </label>
      <label>
        <span>Category</span>
        <input
          aria-label="Programme category"
          value={draft.category}
          disabled={saving}
          onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
        />
      </label>
      <label>
        <span>Description</span>
        <textarea
          aria-label="Programme description"
          rows={2}
          value={draft.description}
          disabled={saving}
          onChange={(event) =>
            setDraft((current) => ({ ...current, description: event.target.value }))
          }
        />
      </label>
      <div className="session-library__form-actions">
        <button type="button" disabled={saving} onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={saving || !valid}>
          {saving ? "Saving…" : "Save Programme"}
        </button>
      </div>
    </form>
  );
}

function MovementForm({ value, onSave, onCancel, saving = false }) {
  const [draft, setDraft] = useState({
    id: cleanText(value?.id),
    name: cleanText(value?.name),
    description: cleanText(value?.description),
  });

  useEffect(() => {
    setDraft({
      id: cleanText(value?.id),
      name: cleanText(value?.name),
      description: cleanText(value?.description),
    });
  }, [value]);

  const valid = !!cleanText(draft.name);

  return (
    <form
      className="session-library__movement-form"
      aria-label={draft.id ? "Edit movement" : "New movement"}
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid || saving) return;
        onSave?.({ ...draft, name: cleanText(draft.name) });
      }}
    >
      <label>
        <span>Name</span>
        <input
          aria-label="Movement name"
          value={draft.name}
          disabled={saving}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
        />
      </label>
      <label>
        <span>Description</span>
        <textarea
          aria-label="Movement description"
          rows={2}
          value={draft.description}
          disabled={saving}
          onChange={(event) =>
            setDraft((current) => ({ ...current, description: event.target.value }))
          }
        />
      </label>
      <div className="session-library__form-actions">
        <button type="button" disabled={saving} onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={saving || !valid}>
          {saving ? "Saving…" : "Save Movement"}
        </button>
      </div>
    </form>
  );
}

export default function SessionTemplateLibrary({
  familyId,
  dbApi = workoutDb,
  confirmArchive = defaultConfirm,
  onLibraryChange,
}) {
  const [library, setLibrary] = useState(() => emptySessionLibrary());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [selectedProgrammeId, setSelectedProgrammeId] = useState("");
  const [view, setView] = useState("sessions");
  const [sessionEditor, setSessionEditor] = useState(null);
  const [programmeForm, setProgrammeForm] = useState(null);
  const [movementForm, setMovementForm] = useState(null);

  const refreshLibrary = useCallback(async ({ preserveStatus = true } = {}) => {
    if (!familyId) {
      setLibrary(emptySessionLibrary());
      setSelectedProgrammeId("");
      return emptySessionLibrary();
    }

    setLoading(true);
    setError("");
    if (!preserveStatus) setStatus("");

    try {
      const result = await dbApi.loadSessionLibrary(familyId);
      const loadError = resultError(result, "Could not load Session Library");
      if (loadError) throw loadError;
      const next = normaliseSessionLibrary(result?.data || {});
      setLibrary(next);
      setSelectedProgrammeId((current) => {
        if (next.programmes.some((programme) => programme.id === current && !programme.archived)) {
          return current;
        }
        return cleanText(next.programmes.find((programme) => !programme.archived)?.id);
      });
      onLibraryChange?.(next);
      return next;
    } catch (loadError) {
      setError(loadError.message || String(loadError));
      return null;
    } finally {
      setLoading(false);
    }
  }, [familyId, dbApi, onLibraryChange]);

  useEffect(() => {
    refreshLibrary({ preserveStatus: false });
  }, [refreshLibrary]);

  const activeProgrammes = useMemo(
    () => library.programmes.filter((programme) => !programme.archived),
    [library.programmes]
  );
  const selectedProgramme = activeProgrammes.find(
    (programme) => programme.id === selectedProgrammeId
  ) || null;
  const sessions = useMemo(
    () => getProgrammeSessions(library, selectedProgrammeId),
    [library, selectedProgrammeId]
  );
  const activeMovements = useMemo(
    () => library.movements.filter((movement) => !movement.archived),
    [library.movements]
  );

  const perform = async (work, successMessage) => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const value = await work();
      if (successMessage) setStatus(successMessage);
      return value;
    } catch (workError) {
      setError(workError.message || String(workError));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const saveProgramme = async (draft) => {
    await perform(async () => {
      let saved;
      if (draft.id) {
        saved = await expectMutation(
          dbApi.updateProgramme(draft.id, {
            name: draft.name,
            category: draft.category,
            description: draft.description,
          }),
          "Could not update Programme"
        );
      } else {
        const nextSortOrder = activeProgrammes.reduce(
          (max, programme) => Math.max(max, Number(programme.sort_order ?? programme.sortOrder ?? 0)),
          -1
        ) + 1;
        saved = await expectMutation(
          dbApi.createProgramme(familyId, {
            name: draft.name,
            category: draft.category,
            description: draft.description,
            sortOrder: nextSortOrder,
          }),
          "Could not create Programme"
        );
      }
      setProgrammeForm(null);
      const next = await refreshLibrary();
      if (saved?.id && next?.programmes.some((item) => item.id === saved.id)) {
        setSelectedProgrammeId(saved.id);
      }
      return saved;
    }, draft.id ? "Programme updated." : "Programme created.");
  };

  const archiveProgramme = async (programme) => {
    const linkedSessions = activeSessionsInProgramme(library, programme.id);
    if (linkedSessions.length) {
      setError(
        `Archive or move ${linkedSessions.length} active Session${linkedSessions.length === 1 ? "" : "s"} before archiving this Programme.`
      );
      return;
    }
    if (!confirmArchive(`Archive Programme “${programme.name}”?`)) return;
    await perform(async () => {
      await expectMutation(
        dbApi.archiveProgramme(programme.id, true),
        "Could not archive Programme"
      );
      setProgrammeForm(null);
      await refreshLibrary();
    }, "Programme archived.");
  };

  const saveMovement = async (draft) => {
    await perform(async () => {
      if (draft.id) {
        await expectMutation(
          dbApi.updateMovement(draft.id, {
            name: draft.name,
            description: draft.description,
          }),
          "Could not update Movement"
        );
      } else {
        await expectMutation(
          dbApi.createMovement(familyId, {
            name: draft.name,
            description: draft.description,
          }),
          "Could not create Movement"
        );
      }
      setMovementForm(null);
      await refreshLibrary();
    }, draft.id ? "Movement updated." : "Movement created.");
  };

  const archiveMovement = async (movement) => {
    const linkedSessions = activeSessionsUsingMovement(library, movement.id);
    if (linkedSessions.length) {
      setError(
        `Remove this Movement from ${linkedSessions.length} active Session${linkedSessions.length === 1 ? "" : "s"} before archiving it.`
      );
      return;
    }
    if (!confirmArchive(`Archive Movement “${movement.name}”?`)) return;
    await perform(async () => {
      await expectMutation(
        dbApi.archiveMovement(movement.id, true),
        "Could not archive Movement"
      );
      setMovementForm(null);
      await refreshLibrary();
    }, "Movement archived.");
  };

  const openNewSession = () => {
    if (!selectedProgrammeId) {
      setError("Create or select a Programme before creating a Session.");
      return;
    }
    setError("");
    setSessionEditor({
      originalDefinition: null,
      definition: {
        template: {
          programmeId: selectedProgrammeId,
          displayCode: "",
          name: "",
          description: "",
          plannedDurationSec: null,
          version: 1,
          sortOrder: sessions.length,
        },
        templateMovements: [],
      },
    });
  };

  const openEditSession = (templateId) => {
    const definition = getTemplateDefinition(library, templateId);
    if (!definition) {
      setError("That Session could not be found in the current library.");
      return;
    }
    setError("");
    setSessionEditor({
      originalDefinition: definition,
      definition,
    });
  };

  const saveSession = async (definition) => {
    const editorState = sessionEditor;
    await perform(async () => {
      const saved = await persistSessionDefinition({
        familyId,
        definition,
        originalDefinition: editorState?.originalDefinition || null,
        db: dbApi,
      });
      setSessionEditor(null);
      const next = await refreshLibrary();
      const programmeId = cleanText(
        saved?.template?.programme_id ?? saved?.template?.programmeId ?? definition?.template?.programmeId
      );
      if (programmeId && next?.programmes.some((item) => item.id === programmeId)) {
        setSelectedProgrammeId(programmeId);
      }
      return saved;
    }, definition?.template?.id ? "Session updated." : "Session created.");
  };

  const archiveSession = async (template) => {
    if (!confirmArchive(`Archive Session “${template.name}”?`)) return;
    await perform(async () => {
      await expectMutation(
        dbApi.archiveSessionTemplate(template.id, true),
        "Could not archive Session"
      );
      if (sessionEditor?.definition?.template?.id === template.id) setSessionEditor(null);
      await refreshLibrary();
    }, "Session archived.");
  };

  if (!familyId) {
    return (
      <section className="session-library" aria-label="Session Library">
        <p>No family selected.</p>
      </section>
    );
  }

  return (
    <section className="session-library" aria-label="Session Library">
      <header className="session-library__header">
        <div>
          <span className="session-library__eyebrow">Training definitions</span>
          <h2>Session Library</h2>
          <p>Programmes, reusable movements and structured Session templates.</p>
        </div>
        <button type="button" disabled={loading || busy} onClick={() => refreshLibrary({ preserveStatus: false })}>
          Refresh
        </button>
      </header>

      <nav className="session-library__tabs" aria-label="Session Library sections">
        <button
          type="button"
          aria-pressed={view === "sessions"}
          onClick={() => setView("sessions")}
        >
          Sessions
        </button>
        <button
          type="button"
          aria-pressed={view === "movements"}
          onClick={() => setView("movements")}
        >
          Movements
        </button>
      </nav>

      {loading ? <p role="status">Loading Session Library…</p> : null}
      {error ? <div className="session-library__error" role="alert">{error}</div> : null}
      {status ? <div className="session-library__status" role="status">{status}</div> : null}

      {view === "sessions" ? (
        <div className="session-library__sessions-view">
          <aside className="session-library__programmes" aria-label="Programmes">
            <div className="session-library__section-heading">
              <h3>Programmes</h3>
              <button
                type="button"
                disabled={busy}
                onClick={() => setProgrammeForm({ id: "", name: "", category: "", description: "" })}
              >
                + Programme
              </button>
            </div>

            {activeProgrammes.length ? (
              <div className="session-library__programme-list">
                {activeProgrammes.map((programme) => {
                  const count = getProgrammeSessions(library, programme.id).length;
                  return (
                    <div className="session-library__programme-row" key={programme.id}>
                      <button
                        type="button"
                        className="session-library__programme-select"
                        aria-pressed={programme.id === selectedProgrammeId}
                        onClick={() => {
                          setSelectedProgrammeId(programme.id);
                          setSessionEditor(null);
                        }}
                      >
                        <span>{programme.name}</span>
                        <small>{count} Session{count === 1 ? "" : "s"}</small>
                      </button>
                      <button
                        type="button"
                        aria-label={`Edit Programme ${programme.name}`}
                        disabled={busy}
                        onClick={() => setProgrammeForm(programme)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        aria-label={`Archive Programme ${programme.name}`}
                        disabled={busy}
                        onClick={() => archiveProgramme(programme)}
                      >
                        Archive
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p>No Programmes yet.</p>
            )}

            {programmeForm ? (
              <ProgrammeForm
                value={programmeForm}
                saving={busy}
                onSave={saveProgramme}
                onCancel={() => setProgrammeForm(null)}
              />
            ) : null}
          </aside>

          <main className="session-library__templates">
            <div className="session-library__section-heading">
              <div>
                <h3>{selectedProgramme?.name || "Sessions"}</h3>
                {selectedProgramme?.description ? <p>{selectedProgramme.description}</p> : null}
              </div>
              <button
                type="button"
                disabled={busy || !selectedProgrammeId}
                onClick={openNewSession}
              >
                + New Session
              </button>
            </div>

            {sessionEditor ? (
              <SessionTemplateEditor
                template={sessionEditor.definition.template}
                templateMovements={sessionEditor.definition.templateMovements}
                programmes={activeProgrammes}
                canonicalMovements={activeMovements}
                disabled={busy}
                saving={busy}
                onCancel={() => setSessionEditor(null)}
                onSave={saveSession}
              />
            ) : sessions.length ? (
              <div className="session-library__template-list">
                {sessions.map((template) => (
                  <article className="session-library__template-card" key={template.id}>
                    <div>
                      <small>{cleanText(template.display_code ?? template.displayCode, "Session")}</small>
                      <h4>{template.name}</h4>
                      <span>Version {Math.max(1, Number(template.version) || 1)}</span>
                      {template.planned_duration_sec ?? template.plannedDurationSec ? (
                        <span>
                          {Math.round(Number(template.planned_duration_sec ?? template.plannedDurationSec) / 60)} min
                        </span>
                      ) : null}
                    </div>
                    <div className="session-library__template-actions">
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Edit Session ${template.name}`}
                        onClick={() => openEditSession(template.id)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Archive Session ${template.name}`}
                        onClick={() => archiveSession(template)}
                      >
                        Archive
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : selectedProgrammeId ? (
              <p>No Sessions in this Programme yet.</p>
            ) : (
              <p>Create a Programme to start building Sessions.</p>
            )}
          </main>
        </div>
      ) : (
        <div className="session-library__movements-view">
          <div className="session-library__section-heading">
            <div>
              <h3>Canonical Movements</h3>
              <p>Reusable drills and movements that Session templates reference by ID.</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMovementForm({ id: "", name: "", description: "" })}
            >
              + New Movement
            </button>
          </div>

          {movementForm ? (
            <MovementForm
              value={movementForm}
              saving={busy}
              onSave={saveMovement}
              onCancel={() => setMovementForm(null)}
            />
          ) : null}

          {activeMovements.length ? (
            <div className="session-library__movement-list">
              {activeMovements.map((movement) => {
                const linked = activeSessionsUsingMovement(library, movement.id);
                return (
                  <article className="session-library__movement-card" key={movement.id}>
                    <div>
                      <h4>{movement.name}</h4>
                      {movement.description ? <p>{movement.description}</p> : null}
                      <small>
                        Used in {linked.length} active Session{linked.length === 1 ? "" : "s"}
                      </small>
                    </div>
                    <div>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Edit Movement ${movement.name}`}
                        onClick={() => setMovementForm(movement)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Archive Movement ${movement.name}`}
                        onClick={() => archiveMovement(movement)}
                      >
                        Archive
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p>No canonical Movements yet.</p>
          )}
        </div>
      )}
    </section>
  );
}
