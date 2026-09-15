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

function canonicalActivityFamily(value) {
  const token = text(value, "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (/(strength|weight_?training|weights|weightlifting|resistance)/.test(token)) return "strength";
  return token;
}

function isoMs(value) {
  const ms = Date.parse(text(value));
  return Number.isFinite(ms) ? ms : null;
}

function strengthBlockPerformed(block) {
  return Object.values(block?.sets || {}).some((sets) =>
    (Array.isArray(sets) ? sets : []).some((set) => {
      const values = [set?.reps, set?.weight, set?.timeSeconds, set?.seconds];
      return values.some((value) => Number.isFinite(Number(value)) && Number(value) > 0);
    })
  );
}

function strengthActivityCoversBlock(data, verifiedActivityId, block) {
  if (text(block?.typeId).toLowerCase() !== "strength" || !strengthBlockPerformed(block)) return false;
  const activity = (data?.verifiedActivities || []).find((row) => row.id === verifiedActivityId);
  if (canonicalActivityFamily(activity?.activity_type) !== "strength") return false;

  const blockStart = isoMs(block?.startedAt || block?.loggedAt);
  const blockEnd = isoMs(block?.completedAt || block?.updatedAt) ?? blockStart;
  if (blockStart === null || blockEnd === null) return false;

  const observationIds = new Set(
    (data?.observationLinks || [])
      .filter((row) => row.verified_activity_id === verifiedActivityId)
      .map((row) => row.observation_id)
  );
  const observations = (data?.observations || []).filter(
    (row) => observationIds.has(row.id) && !row.source_deleted_at && row.source_manual_entry !== true
  );
  const evidenceStarts = [activity?.started_at, ...observations.map((row) => row.started_at)]
    .map(isoMs)
    .filter((value) => value !== null);
  if (!evidenceStarts.length) return false;
  const evidenceStart = Math.min(...evidenceStarts);
  const evidenceEnds = observations.map((row) => {
    const start = isoMs(row.started_at);
    const durationSec = Number(row.moving_duration_sec) > 0
      ? Number(row.moving_duration_sec)
      : Number(row.elapsed_duration_sec) > 0
        ? Number(row.elapsed_duration_sec)
        : 0;
    return start !== null && durationSec > 0 ? start + durationSec * 1000 : null;
  }).filter((value) => value !== null);
  const evidenceEnd = evidenceEnds.length ? Math.max(...evidenceEnds) : evidenceStart;
  const toleranceMs = 5 * 60 * 1000;
  return blockStart <= evidenceEnd + toleranceMs && blockEnd >= evidenceStart - toleranceMs;
}

function directLinkStatus(block) {
  const type = text(block?.typeId).toLowerCase();
  if (type === "strength") return "verified";
  return ["hiit", "box", "session"].includes(type) ? "partial" : "verified";
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
    manualLogId && link.manual_log_id === manualLogId
  );
  const directByBlock = new Map(
    manualLinks.filter((link) => text(link.manual_block_id)).map((link) => [text(link.manual_block_id), link])
  );
  const verifiedActivityById = new Map((data.verifiedActivities || []).map((row) => [row.id, row]));
  const strengthSessionLinks = manualLinks.filter((link) =>
    canonicalActivityFamily(verifiedActivityById.get(link.verified_activity_id)?.activity_type) === "strength"
  );
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
    const type = text(block?.typeId).toLowerCase();
    const sessionLink = type === "strength"
      ? strengthSessionLinks.find((link) =>
          link === direct || strengthActivityCoversBlock(data, link.verified_activity_id, block)
        ) || null
      : null;
    const linked = direct || sessionLink;
    const automatic = automaticByBlock.get(block.id) || null;
    if (linked) {
      const providers = providerMap.get(linked.verified_activity_id) || [];
      const strengthSessionEvidence = type === "strength" &&
        canonicalActivityFamily(verifiedActivityById.get(linked.verified_activity_id)?.activity_type) === "strength";
      return {
        blockId: block.id,
        label: blockLabel(block, index),
        status: strengthSessionEvidence ? "verified" : directLinkStatus(block),
        providers,
        performedDate: performedDateForActivity(data, linked.verified_activity_id),
        matchMethod: linked.match_method === "manual"
          ? strengthSessionEvidence ? "Athlete confirmed · session evidence" : "Athlete confirmed"
          : strengthSessionEvidence ? "Automatically matched · session evidence" : "Automatically matched",
        verifiedActivityId: linked.verified_activity_id,
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
