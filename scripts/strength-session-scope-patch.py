from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    source = p.read_text()
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one match in {path}, found {count}")
    p.write_text(source.replace(old, new, 1))


log_summary = "src/components/verification/LogVerificationSummary.jsx"

replace_once(
    log_summary,
    '''function directLinkStatus(block) {
  const type = text(block?.typeId).toLowerCase();
  return ["strength", "hiit", "box", "session"].includes(type) ? "partial" : "verified";
}
''',
    '''function canonicalActivityFamily(value) {
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
'''
)

replace_once(
    log_summary,
    '''  const manualLinks = (data.manualLinks || []).filter((link) =>
    manualLogId && link.manual_log_id === manualLogId && text(link.manual_block_id)
  );
  const directByBlock = new Map(manualLinks.map((link) => [text(link.manual_block_id), link]));
''',
    '''  const manualLinks = (data.manualLinks || []).filter((link) =>
    manualLogId && link.manual_log_id === manualLogId
  );
  const directByBlock = new Map(
    manualLinks.filter((link) => text(link.manual_block_id)).map((link) => [text(link.manual_block_id), link])
  );
  const verifiedActivityById = new Map((data.verifiedActivities || []).map((row) => [row.id, row]));
  const strengthSessionLinks = manualLinks.filter((link) =>
    canonicalActivityFamily(verifiedActivityById.get(link.verified_activity_id)?.activity_type) === "strength"
  );
'''
)

replace_once(
    log_summary,
    '''  const rows = sourceBlocks.map((block, index) => {
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
''',
    '''  const rows = sourceBlocks.map((block, index) => {
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
'''
)

progress = "src/components/progress/VerifiedActivityEvidenceSection.jsx"
replace_once(
    progress,
    '''function candidateMetrics(candidate) {
  const parts = [];
  if (Number(candidate?.distanceM) > 0) parts.push(formatDistanceMetres(candidate.distanceM));
  if (Number(candidate?.durationSec) > 0) parts.push(formatDurationSeconds(candidate.durationSec));
  return parts.join(" · ");
}
''',
    '''function candidateMetrics(candidate) {
  const parts = [];
  if (Number(candidate?.distanceM) > 0) parts.push(formatDistanceMetres(candidate.distanceM));
  if (Number(candidate?.durationSec) > 0) parts.push(formatDurationSeconds(candidate.durationSec));
  return parts.join(" · ");
}

function candidateIsStrength(candidate) {
  const token = text(candidate?.activityType, "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return /(strength|weight_?training|weights|weightlifting|resistance)/.test(token);
}

function candidateInterval(candidate) {
  const start = Date.parse(text(candidate?.startedAt));
  if (!Number.isFinite(start)) return null;
  const explicitEnd = Date.parse(text(candidate?.completedAt));
  const durationSec = Number(candidate?.durationSec);
  const end = Number.isFinite(explicitEnd) && explicitEnd >= start
    ? explicitEnd
    : Number.isFinite(durationSec) && durationSec > 0
      ? start + durationSec * 1000
      : start;
  return { start, end };
}

export function groupManualMatchCandidates(candidates = []) {
  const source = Array.isArray(candidates) ? candidates : [];
  const consumed = new Set();
  const grouped = [];
  const toleranceMs = 2 * 60 * 1000;

  source.forEach((candidate, index) => {
    if (consumed.has(index)) return;
    const interval = candidateInterval(candidate);
    if (!candidateIsStrength(candidate) || !interval || !candidate?.manualLogId) {
      grouped.push(candidate);
      consumed.add(index);
      return;
    }

    const cluster = [{ candidate, index, interval }];
    consumed.add(index);
    let clusterStart = interval.start;
    let clusterEnd = interval.end;
    let changed = true;
    while (changed) {
      changed = false;
      source.forEach((peer, peerIndex) => {
        if (consumed.has(peerIndex) || peer?.manualLogId !== candidate.manualLogId || !candidateIsStrength(peer)) return;
        const peerInterval = candidateInterval(peer);
        if (!peerInterval) return;
        if (peerInterval.start <= clusterEnd + toleranceMs && peerInterval.end >= clusterStart - toleranceMs) {
          cluster.push({ candidate: peer, index: peerIndex, interval: peerInterval });
          consumed.add(peerIndex);
          clusterStart = Math.min(clusterStart, peerInterval.start);
          clusterEnd = Math.max(clusterEnd, peerInterval.end);
          changed = true;
        }
      });
    }

    if (cluster.length === 1) {
      grouped.push(candidate);
      return;
    }

    const primary = cluster.slice().sort((left, right) => {
      const leftDuration = left.interval.end - left.interval.start;
      const rightDuration = right.interval.end - right.interval.start;
      return rightDuration - leftDuration || left.interval.start - right.interval.start || Number(right.candidate?.score || 0) - Number(left.candidate?.score || 0);
    })[0].candidate;
    grouped.push({
      ...primary,
      displayLabel: `Strength session · ${cluster.length} Workout Tracker blocks`,
      groupedCount: cluster.length,
      durationSec: Math.max(1, Math.round((clusterEnd - clusterStart) / 1000)),
      startedAt: new Date(clusterStart).toISOString(),
      completedAt: new Date(clusterEnd).toISOString(),
      score: Math.max(...cluster.map((entry) => Number(entry.candidate?.score || 0))),
    });
  });

  return grouped.sort((left, right) => Number(right?.score || 0) - Number(left?.score || 0));
}
'''
)

replace_once(
    progress,
    '''    const candidates = candidatesByActivity[activity.id];
    const linked = !!activity.manualLink;
''',
    '''    const candidates = candidatesByActivity[activity.id];
    const displayCandidates = Array.isArray(candidates) ? groupManualMatchCandidates(candidates) : candidates;
    const linked = !!activity.manualLink;
'''
)

replace_once(
    progress,
    '''                {Array.isArray(candidates) ? (
                  candidates.length ? (
                    <div className="verified-candidate-list">
                      {candidates.map((candidate) => (
''',
    '''                {Array.isArray(displayCandidates) ? (
                  displayCandidates.length ? (
                    <div className="verified-candidate-list">
                      {displayCandidates.map((candidate) => (
'''
)

replace_once(
    progress,
    '''                          <span><strong>{candidate.label}</strong><small>{candidate.logDate} · {offsetLabel(candidate.dateOffsetDays)}</small></span>
''',
    '''                          <span><strong>{candidate.displayLabel || candidate.label}</strong><small>{candidate.logDate} · {offsetLabel(candidate.dateOffsetDays)}</small></span>
'''
)

test_path = "src/components/verification/LogVerificationSummary.test.jsx"
replace_once(
    test_path,
    '''    expect(model.overallStatus).toBe("partial");
    expect(model.rows.find((row) => row.blockId === "run-1")?.status).toBe("verified");
    expect(model.rows.find((row) => row.blockId === "strength-1")?.status).toBe("partial");
''',
    '''    expect(model.overallStatus).toBe("verified");
    expect(model.rows.find((row) => row.blockId === "run-1")?.status).toBe("verified");
    expect(model.rows.find((row) => row.blockId === "strength-1")?.status).toBe("verified");
'''
)

replace_once(
    test_path,
    '''    const button = await screen.findByRole("button", { name: /Partially verified/i });
''',
    '''    const button = await screen.findByRole("button", { name: /^Verified/i });
'''
)

replace_once(
    test_path,
    '''  it("hides provenance until the athlete taps the compact status", async () => {
''',
    '''  it("lets one continuous strength evidence session cover overlapping recorded strength blocks", () => {
    const model = buildLogVerificationModel({
      data: data(),
      dateYmd: "2026-09-15",
      manualLogId: "log-1",
      blocks: [
        {
          id: "strength-1",
          typeId: "strength",
          label: "Legs and Chest",
          startedAt: "2026-09-15T18:01:00Z",
          completedAt: "2026-09-15T18:25:00Z",
          sets: { squat: [{ reps: "20", weight: "25" }] },
        },
        {
          id: "strength-extra",
          typeId: "strength",
          label: "Situps",
          startedAt: "2026-09-15T18:20:00Z",
          completedAt: "2026-09-15T18:29:00Z",
          sets: { situps: [{ reps: "30" }] },
        },
      ],
    });

    expect(model.overallStatus).toBe("verified");
    expect(model.verifiedCount).toBe(2);
    expect(model.rows.map((row) => row.status)).toEqual(["verified", "verified"]);
    expect(model.rows[1].matchMethod).toMatch(/session evidence/i);
  });

  it("hides provenance until the athlete taps the compact status", async () => {
'''
)

candidate_test = Path("src/components/progress/VerifiedActivityEvidenceSection.test.jsx")
candidate_test.write_text('''import { describe, expect, it } from "vitest";\nimport { groupManualMatchCandidates } from "./VerifiedActivityEvidenceSection.jsx";\n\ndescribe("VerifiedActivityEvidenceSection strength-session candidate grouping", () => {\n  it("offers overlapping Workout Tracker strength blocks as one physical strength session", () => {\n    const grouped = groupManualMatchCandidates([\n      {\n        manualLogId: "log-1",\n        manualBlockId: "Mon_main",\n        logDate: "2026-09-14",\n        label: "Legs and Chest",\n        activityType: "strength",\n        startedAt: "2026-09-15T18:55:24.886Z",\n        completedAt: "2026-09-15T19:15:35.108Z",\n        durationSec: 1210,\n        score: 1,\n      },\n      {\n        manualLogId: "log-1",\n        manualBlockId: "extra-situps",\n        logDate: "2026-09-14",\n        label: "Strength",\n        activityType: "strength",\n        startedAt: "2026-09-15T19:11:03.817Z",\n        completedAt: "2026-09-15T19:15:35.108Z",\n        durationSec: 271,\n        score: 0.91,\n      },\n    ]);\n\n    expect(grouped).toHaveLength(1);\n    expect(grouped[0].manualBlockId).toBe("Mon_main");\n    expect(grouped[0].displayLabel).toBe("Strength session · 2 Workout Tracker blocks");\n    expect(grouped[0].groupedCount).toBe(2);\n    expect(grouped[0].durationSec).toBeGreaterThan(1200);\n  });\n\n  it("does not merge separate strength sessions just because they share a Workout Tracker log", () => {\n    const grouped = groupManualMatchCandidates([\n      { manualLogId: "log-1", manualBlockId: "a", activityType: "strength", startedAt: "2026-09-15T18:00:00Z", completedAt: "2026-09-15T18:20:00Z", score: 0.9 },\n      { manualLogId: "log-1", manualBlockId: "b", activityType: "strength", startedAt: "2026-09-15T20:00:00Z", completedAt: "2026-09-15T20:20:00Z", score: 0.8 },\n    ]);\n\n    expect(grouped).toHaveLength(2);\n    expect(grouped.every((candidate) => !candidate.groupedCount)).toBe(true);\n  });\n});\n''')
