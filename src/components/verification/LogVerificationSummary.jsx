import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  applyRecentVerifiedAutoPopulation,
  loadVerifiedActivityData,
  undoVerifiedAutoPopulation,
} from "../../verifiedActivityDb.js";
import { buildVerifiedCardioEvidence } from "../../engine/verifiedCardioEvidenceEngine.js";
import { matchVerifiedPlanCompletionEvidence } from "../../engine/verifiedPlanCompletionEngine.js";
import { getAutoPopulationForVerifiedActivity } from "../../engine/verificationAutoPopulationEngine.js";
import "./LogVerificationSummary.css";

const DEFAULT_API = Object.freeze({
  applyRecentVerifiedAutoPopulation,
  loadVerifiedActivityData,
  undoVerifiedAutoPopulation,
});
const VERIFY_TYPES = new Set([
  "strength",
  "hiit",
  "box",
  "cardio",
  "dynamic-cardio",
  "run",
  "swim",
  "duration",
  "session",
]);

function text(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

function blockLabel(block, index) {
  const explicit = text(block?.label || block?.activityName);
  if (explicit) return explicit;
  const type = text(block?.typeId, "activity").replace(/[_-]+/g, " ");
  return `${type.replace(/\b\w/g, (letter) => letter.toUpperCase())}${index > 0 ? ` ${index + 1}` : ""}`;
}

function providersByVerifiedActivity(data = {}) {
  const observationsById = new Map((data.observations || []).map((row) => [row.id, row]));
  const result = new Map();
  for (const link of data.observationLinks || []) {
    const observation = observationsById.get(link.observation_id);
    const provider = text(observation?.provider);
    if (!provider) continue;
    const list = result.get(link.verified_activity_id) || [];
    if (!list.includes(provider)) list.push(provider);
    result.set(link.verified_activity_id, list.sort());
  }
  return result;
}

function performedDateForActivity(data, verifiedActivityId) {
  const activity = (data?.verifiedActivities || []).find((row) => row.id === verifiedActivityId);
  return text(activity?.started_at).slice(0, 10);
}

function providerLabel(value) {
  const provider = text(value).toLowerCase();
  if (provider === "strava") return "Strava";
  if (provider === "garmin") return "Garmin";
  if (provider === "apple_health") return "Apple Health";
  if (provider === "health_connect") return "Health Connect";
  return text(value, "External source").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function directLinkStatus(block) {
  const type = text(block?.typeId).toLowerCase();
  return ["strength", "hiit", "box", "session"].includes(type) ? "partial" : "verified";
}

function hasActiveAutoPopulation(population) {
  if (!population) return false;
  return (population.fields || []).some((row) => row.state === "imported") ||
    (population.extraBlocks || []).some((row) => row.state === "imported");
}

export function buildLogVerificationModel({ data = {}, dateYmd = "", manualLogId = "", blocks = [] } = {}) {
  const sourceBlocks = (Array.isArray(blocks) ? blocks : []).filter(
    (block) => block?.id && VERIFY_TYPES.has(text(block.typeId).toLowerCase()) && !block.cancelled
  );
  const providerMap = providersByVerifiedActivity(data);
  const manualLinks = (data.manualLinks || []).filter((link) =>
    manualLogId && link.manual_log_id === manualLogId && text(link.manual_block_id)
  );
  const directByBlock = new Map(manualLinks.map((link) => [text(link.manual_block_id), link]));
  const verifiedCardio = buildVerifiedCardioEvidence(data);
  const completion = matchVerifiedPlanCompletionEvidence({
    dateYmd,
    expectedBlocks: sourceBlocks,
    manualCompletedBlockIds: [],
    verifiedCardioEvidence: verifiedCardio,
  });
  const automaticByBlock = new Map(
    (completion.assignments || []).map((assignment) => [assignment.expectedBlockId, assignment])
  );

  const rows = sourceBlocks.map((block, index) => {
    const direct = directByBlock.get(block.id) || null;
    const automatic = automaticByBlock.get(block.id) || null;
    if (direct) {
      const providers = providerMap.get(direct.verified_activity_id) || [];
      return {
        blockId: block.id,
        label: blockLabel(block, index),
        status: directLinkStatus(block),
        providers,
        performedDate: performedDateForActivity(data, direct.verified_activity_id),
        matchMethod: direct.match_method === "manual" ? "Athlete confirmed" : "Automatically matched",
        verifiedActivityId: direct.verified_activity_id,
      };
    }
    if (automatic) {
      return {
        blockId: block.id,
        label: blockLabel(block, index),
        status: "verified",
        providers: automatic.providers || [],
        performedDate: dateYmd,
        matchMethod: automatic.matchedManual ? "Matched evidence" : "Compatible provider evidence",
        verifiedActivityId: automatic.verifiedActivityId,
      };
    }
    return {
      blockId: block.id,
      label: blockLabel(block, index),
      status: "unverified",
      providers: [],
      performedDate: "",
      matchMethod: "No compatible evidence linked",
      verifiedActivityId: "",
    };
  });

  const verifiedCount = rows.filter((row) => row.status === "verified").length;
  const partialCount = rows.filter((row) => row.status === "partial").length;
  const overallStatus = !rows.length
    ? "none"
    : verifiedCount === rows.length
      ? "verified"
      : verifiedCount > 0 || partialCount > 0
        ? "partial"
        : "unverified";

  return {
    rows,
    overallStatus,
    verifiedCount,
    partialCount,
    unverifiedCount: Math.max(0, rows.length - verifiedCount - partialCount),
    connectedCount: (data.connections || []).filter((row) => row.status === "active").length,
    hasEvidence: (data.verifiedActivities || []).some((row) => row.status !== "ignored"),
  };
}

function statusCopy(status) {
  if (status === "verified") return { symbol: "✓", label: "Verified" };
  if (status === "partial") return { symbol: "◐", label: "Partially verified" };
  return { symbol: "○", label: "Not verified" };
}

export default function LogVerificationSummary({
  profileId,
  dateYmd,
  manualLogId = "",
  blocks = [],
  logJson = null,
  onAutoPopulationChanged = null,
  onOpenProgress = null,
  api = DEFAULT_API,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoBusy, setAutoBusy] = useState("");
  const [autoError, setAutoError] = useState("");
  const appliedProfileRef = useRef("");

  useEffect(() => {
    let active = true;
    if (!profileId || typeof api.applyRecentVerifiedAutoPopulation !== "function") return () => { active = false; };
    if (appliedProfileRef.current === profileId) return () => { active = false; };
    appliedProfileRef.current = profileId;
    Promise.resolve(api.applyRecentVerifiedAutoPopulation(profileId))
      .then((result) => {
        if (!active || result?.error) return;
        const summary = result?.data || {};
        const changed = Number(summary.logsChanged || 0) > 0 || Number(summary.fieldsFilled || 0) > 0 || Number(summary.extraBlocksCreated || 0) > 0;
        if (changed) {
          setRefreshKey((value) => value + 1);
          onAutoPopulationChanged?.(summary);
        }
      })
      .catch(() => null);
    return () => { active = false; };
  }, [api, onAutoPopulationChanged, profileId]);

  useEffect(() => {
    let active = true;
    if (!profileId) {
      setData(null);
      return () => { active = false; };
    }
    setLoading(true);
    Promise.resolve(api.loadVerifiedActivityData(profileId))
      .then((result) => {
        if (!active) return;
        if (!result?.error) setData(result?.data || null);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [api, profileId, refreshKey]);

  const model = useMemo(
    () => buildLogVerificationModel({ data: data || {}, dateYmd, manualLogId, blocks }),
    [blocks, data, dateYmd, manualLogId]
  );

  async function undoPopulation(verifiedActivityId) {
    if (!verifiedActivityId || typeof api.undoVerifiedAutoPopulation !== "function") return;
    setAutoBusy(verifiedActivityId);
    setAutoError("");
    try {
      const result = await api.undoVerifiedAutoPopulation(profileId, verifiedActivityId);
      if (result?.error) throw result.error;
      setRefreshKey((value) => value + 1);
      onAutoPopulationChanged?.(result?.data || {});
    } catch (error) {
      setAutoError(error?.message || "Automatic fill could not be undone.");
    } finally {
      setAutoBusy("");
    }
  }

  if (loading || model.overallStatus === "none") return null;
  if (!model.connectedCount && !model.hasEvidence) return null;

  const overall = statusCopy(model.overallStatus);

  return (
    <section className={`log-verification log-verification--${model.overallStatus}`} aria-label="Workout verification status">
      <button
        type="button"
        className="log-verification__summary"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="log-verification__icon" aria-hidden="true">{overall.symbol}</span>
        <span>
          <strong>{overall.label}</strong>
          <small>{expanded ? "Hide verification detail" : "Tap for verification detail"}</small>
        </span>
        <span className="log-verification__counts">
          {model.verifiedCount}/{model.rows.length}
        </span>
      </button>

      {expanded ? (
        <div className="log-verification__detail">
          {model.rows.map((row) => {
            const copy = statusCopy(row.status);
            const population = row.verifiedActivityId
              ? getAutoPopulationForVerifiedActivity(logJson, row.verifiedActivityId)
              : null;
            const autoFilled = hasActiveAutoPopulation(population);
            return (
              <div key={row.blockId} className={`log-verification__row is-${row.status}`}>
                <span aria-hidden="true">{copy.symbol}</span>
                <span>
                  <strong>{row.label}</strong>
                  <small>
                    {copy.label}
                    {row.providers.length ? ` · ${row.providers.map(providerLabel).join(" + ")}` : ""}
                    {row.performedDate && row.performedDate !== dateYmd ? ` · performed ${row.performedDate}` : ""}
                    {row.matchMethod ? ` · ${row.matchMethod}` : ""}
                    {autoFilled ? " · ↓ Auto-filled" : ""}
                  </small>
                  {autoFilled ? (
                    <button
                      type="button"
                      className="log-verification__undo"
                      disabled={!!autoBusy}
                      onClick={() => undoPopulation(row.verifiedActivityId)}
                    >
                      {autoBusy === row.verifiedActivityId ? "Undoing…" : "Undo automatic fill"}
                    </button>
                  ) : null}
                </span>
              </div>
            );
          })}
          {autoError ? <div className="log-verification__error" role="alert">{autoError}</div> : null}
          <div className="log-verification__footer">
            <span>Verification does not add bonus XP or overwrite manual entries. Automatic fills are provenance-tracked and reversible.</span>
            {typeof onOpenProgress === "function" ? (
              <button type="button" onClick={onOpenProgress}>Open verification details</button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
