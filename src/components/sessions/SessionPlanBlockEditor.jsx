import React, { useEffect, useMemo, useState } from "react";
import { loadSessionLibrary } from "../../db.js";
import { normaliseSessionLibrary } from "./sessionLibraryController.js";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function toNullableNonNegativeInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

export function createSessionPlanBlock(id = "") {
  return {
    id,
    typeId: "session",
    label: "",
    note: "",
    sessionTemplateId: "",
    sessionTemplateNameSnapshot: "",
    plannedDurationSecOverride: null,
  };
}

export function normaliseSessionPlanBlock(block = {}, fallbackId = "") {
  return {
    id: cleanText(block.id, fallbackId),
    typeId: "session",
    label: cleanText(block.label),
    note: typeof block.note === "string" ? block.note : "",
    sessionTemplateId: cleanText(
      block.sessionTemplateId ?? block.session_template_id
    ),
    sessionTemplateNameSnapshot: cleanText(
      block.sessionTemplateNameSnapshot ?? block.session_template_name_snapshot
    ),
    plannedDurationSecOverride: toNullableNonNegativeInt(
      block.plannedDurationSecOverride ?? block.planned_duration_sec_override
    ),
  };
}

function templateProgrammeId(template) {
  return cleanText(template?.programme_id ?? template?.programmeId);
}

function templateCode(template) {
  return cleanText(template?.display_code ?? template?.displayCode);
}

function templateDurationSec(template) {
  return toNullableNonNegativeInt(
    template?.planned_duration_sec ?? template?.plannedDurationSec
  );
}

function templateVersion(template) {
  const n = Number(template?.version);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 1;
}

export function getSessionTemplateSnapshotName(template) {
  if (!template) return "";
  const code = templateCode(template);
  const name = cleanText(template.name, "Untitled Session");
  return code ? `Session ${code} — ${name}` : name;
}

export function getSessionPlanDefaultLabel(template, programme) {
  if (!template) return "";
  const programmeName = cleanText(programme?.name);
  const code = templateCode(template);
  const sessionName = cleanText(template.name, "Session");

  if (programmeName && code) return `${programmeName} — Session ${code}`;
  if (programmeName) return `${programmeName} — ${sessionName}`;
  if (code) return `Session ${code} — ${sessionName}`;
  return sessionName;
}

export function formatSessionPlanDuration(seconds) {
  const total = toNullableNonNegativeInt(seconds);
  if (total === null) return "";
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  if (!secs) return `${minutes} min`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function parseMinutesOverride(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 60);
}

function resultError(result) {
  if (!result?.error) return "";
  return result.error?.message || String(result.error);
}

export default function SessionPlanBlockEditor({
  familyId,
  block,
  onChange,
  disabled = false,
  dbApi = { loadSessionLibrary },
}) {
  const safeBlock = normaliseSessionPlanBlock(block);
  const [library, setLibrary] = useState(() => normaliseSessionLibrary({}));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [overrideDraft, setOverrideDraft] = useState(
    safeBlock.plannedDurationSecOverride == null
      ? ""
      : String(safeBlock.plannedDurationSecOverride / 60)
  );

  useEffect(() => {
    setOverrideDraft(
      safeBlock.plannedDurationSecOverride == null
        ? ""
        : String(safeBlock.plannedDurationSecOverride / 60)
    );
  }, [safeBlock.plannedDurationSecOverride]);

  useEffect(() => {
    let cancelled = false;

    if (!familyId) {
      setLibrary(normaliseSessionLibrary({}));
      setLoading(false);
      setError("");
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError("");

    Promise.resolve(dbApi.loadSessionLibrary(familyId))
      .then((result) => {
        if (cancelled) return;
        const message = resultError(result);
        if (message) {
          setError(message);
          setLibrary(normaliseSessionLibrary({}));
          return;
        }
        setLibrary(normaliseSessionLibrary(result?.data || {}));
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError?.message || String(loadError));
        setLibrary(normaliseSessionLibrary({}));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [familyId, dbApi]);

  const activeProgrammes = useMemo(
    () => (library.programmes || []).filter((item) => item && !item.archived),
    [library.programmes]
  );

  const activeTemplates = useMemo(
    () =>
      (library.templates || [])
        .filter((item) => item && !item.archived)
        .slice()
        .sort((a, b) => {
          const pA = activeProgrammes.find((p) => p.id === templateProgrammeId(a));
          const pB = activeProgrammes.find((p) => p.id === templateProgrammeId(b));
          const programmeDiff = cleanText(pA?.name).localeCompare(cleanText(pB?.name));
          if (programmeDiff) return programmeDiff;
          const sortDiff = Number(a.sort_order ?? a.sortOrder ?? 0) - Number(b.sort_order ?? b.sortOrder ?? 0);
          if (sortDiff) return sortDiff;
          return cleanText(a.name).localeCompare(cleanText(b.name));
        }),
    [library.templates, activeProgrammes]
  );

  const selectedTemplate = activeTemplates.find(
    (item) => item.id === safeBlock.sessionTemplateId
  ) || null;
  const selectedProgramme = selectedTemplate
    ? activeProgrammes.find((item) => item.id === templateProgrammeId(selectedTemplate)) || null
    : null;

  const selectedSnapshotName = selectedTemplate
    ? getSessionTemplateSnapshotName(selectedTemplate)
    : safeBlock.sessionTemplateNameSnapshot;

  const effectiveDurationSec =
    safeBlock.plannedDurationSecOverride ?? templateDurationSec(selectedTemplate);

  const emit = (patch) => {
    if (disabled || typeof onChange !== "function") return;
    onChange(patch);
  };

  const selectTemplate = (templateId) => {
    const template = activeTemplates.find((item) => item.id === templateId) || null;
    if (!template) {
      emit({
        sessionTemplateId: "",
        sessionTemplateNameSnapshot: "",
        plannedDurationSecOverride: null,
      });
      return;
    }

    const programme = activeProgrammes.find(
      (item) => item.id === templateProgrammeId(template)
    ) || null;
    const patch = {
      sessionTemplateId: template.id,
      sessionTemplateNameSnapshot: getSessionTemplateSnapshotName(template),
      plannedDurationSecOverride: null,
    };

    if (!cleanText(safeBlock.label)) {
      patch.label = getSessionPlanDefaultLabel(template, programme);
    }

    emit(patch);
  };

  const commitOverride = () => {
    if (disabled) return;
    const parsed = parseMinutesOverride(overrideDraft);
    if (String(overrideDraft || "").trim() && parsed === null) {
      setOverrideDraft(
        safeBlock.plannedDurationSecOverride == null
          ? ""
          : String(safeBlock.plannedDurationSecOverride / 60)
      );
      return;
    }
    emit({ plannedDurationSecOverride: parsed });
  };

  return (
    <div className="session-plan-block-editor" aria-label="Session plan block settings">
      <div className="mt12">
        <div className="label">Session template</div>
        <select
          aria-label="Session template"
          value={selectedTemplate?.id || ""}
          disabled={disabled || loading}
          onChange={(event) => selectTemplate(event.target.value)}
        >
          <option value="">
            {loading ? "Loading Sessions…" : "Choose a Session…"}
          </option>
          {activeTemplates.map((template) => {
            const programme = activeProgrammes.find(
              (item) => item.id === templateProgrammeId(template)
            );
            const programmeName = cleanText(programme?.name, "Programme");
            const snapshotName = getSessionTemplateSnapshotName(template);
            const duration = formatSessionPlanDuration(templateDurationSec(template));
            return (
              <option key={template.id} value={template.id}>
                {programmeName} · {snapshotName}{duration ? ` · ${duration}` : ""}
              </option>
            );
          })}
        </select>
      </div>

      {error ? (
        <div className="muted mt8" role="alert">
          Could not load Session Library: {error}
        </div>
      ) : null}

      {!loading && !error && activeTemplates.length === 0 ? (
        <div className="muted mt8">
          No active Session templates are available yet.
        </div>
      ) : null}

      {selectedTemplate ? (
        <div className="panel mt8 session-plan-block-editor__summary">
          <div className="row between">
            <div>
              <div className="h3">{selectedSnapshotName}</div>
              <div className="muted mt4">
                {cleanText(selectedProgramme?.name, "Programme")}
                {templateDurationSec(selectedTemplate) != null
                  ? ` · ${formatSessionPlanDuration(templateDurationSec(selectedTemplate))}`
                  : ""}
                {` · v${templateVersion(selectedTemplate)}`}
              </div>
            </div>
          </div>

          <div className="mt8">
            <div className="label">Duration override (minutes, optional)</div>
            <input
              type="number"
              min="0"
              step="0.5"
              aria-label="Session duration override minutes"
              value={overrideDraft}
              disabled={disabled}
              placeholder={
                templateDurationSec(selectedTemplate) == null
                  ? "Optional"
                  : String(templateDurationSec(selectedTemplate) / 60)
              }
              onChange={(event) => setOverrideDraft(event.target.value)}
              onBlur={commitOverride}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setOverrideDraft(
                    safeBlock.plannedDurationSecOverride == null
                      ? ""
                      : String(safeBlock.plannedDurationSecOverride / 60)
                  );
                  event.currentTarget.blur();
                }
              }}
            />
            <div className="muted mt4">
              Planned duration: {effectiveDurationSec == null
                ? "not set"
                : formatSessionPlanDuration(effectiveDurationSec)}
              {safeBlock.plannedDurationSecOverride != null ? " (override)" : ""}
            </div>
          </div>
        </div>
      ) : safeBlock.sessionTemplateId && safeBlock.sessionTemplateNameSnapshot ? (
        <div className="muted mt8">
          Saved template: {safeBlock.sessionTemplateNameSnapshot}. It is currently unavailable or archived.
        </div>
      ) : null}
    </div>
  );
}
