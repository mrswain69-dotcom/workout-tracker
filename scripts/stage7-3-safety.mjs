import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`);
  return source.replace(before, after);
}

const enginePath = "src/engine/verificationAutoPopulationEngine.js";
let engine = fs.readFileSync(enginePath, "utf8");
engine = replaceOnce(
  engine,
  `    .map((block, index) => {\n      let emptyCount = 0;\n      for (const path of Object.keys(metricValues)) if (empty(getPath(block, path))) emptyCount += 1;\n      return { block, index, emptyCount, exact: blockFamily(block) === family };\n    })\n    .filter((candidate) => candidate.emptyCount > 0)\n    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.emptyCount - a.emptyCount || a.index - b.index);\n\n  const base = provenanceBase(activity, nowIso);\n  if (candidates.length) {\n    const target = candidates[0].block;`,
  `    .map((block, index) => {\n      let emptyCount = 0;\n      for (const path of Object.keys(metricValues)) if (empty(getPath(block, path))) emptyCount += 1;\n      const manualMetricCount = ["cardio.distanceKm", "cardio.durationMin"]\n        .filter((path) => !empty(getPath(block, path))).length;\n      return { block, index, emptyCount, manualMetricCount, exact: blockFamily(block) === family };\n    })\n    .filter((candidate) => candidate.emptyCount > 0)\n    .sort((a, b) => b.manualMetricCount - a.manualMetricCount || Number(b.exact) - Number(a.exact) || b.emptyCount - a.emptyCount || a.index - b.index);\n\n  const base = provenanceBase(activity, nowIso);\n  const firstCandidate = candidates[0] || null;\n  const secondCandidate = candidates[1] || null;\n  const hasUniqueSafeTarget = !!firstCandidate && (\n    !secondCandidate ||\n    firstCandidate.manualMetricCount > secondCandidate.manualMetricCount ||\n    (firstCandidate.exact && !secondCandidate.exact)\n  );\n  if (hasUniqueSafeTarget) {\n    const target = firstCandidate.block;`,
  "ambiguous planned target guard"
);
fs.writeFileSync(enginePath, engine);

const helperPath = "supabase/functions/_shared/verificationAutoPopulate.ts";
let helper = fs.readFileSync(helperPath, "utf8");
helper = replaceOnce(
  helper,
  `    const population = applyVerifiedActivityPopulation({ logJson: transient, planBlocks, evidence, nowIso });\n    if (!population.changed || !population.targetBlockId) continue;\n\n    for (const block of Array.isArray(population.logJson?.blocks) ? population.logJson.blocks : []) {`,
  `    const population = applyVerifiedActivityPopulation({ logJson: transient, planBlocks, evidence, nowIso });\n    if (!population.changed) continue;\n\n    if (!population.targetBlockId) {\n      const savedState = await adminClient.from("logs").upsert({\n        family_id: profile.family_id,\n        profile_id: profile.id,\n        date_ymd: dateYmd,\n        log_json: population.logJson,\n      }, { onConflict: "family_id,profile_id,date_ymd" }).select("id,date_ymd,log_json").single();\n      if (savedState.error) throw savedState.error;\n      logByDate.set(dateYmd, savedState.data);\n      summary.manualOverridesPreserved += population.manualOverridesPreserved || 0;\n      changedDates.add(dateYmd);\n      continue;\n    }\n\n    for (const block of Array.isArray(population.logJson?.blocks) ? population.logJson.blocks : []) {`,
  "persist manual override provenance"
);
fs.writeFileSync(helperPath, helper);

console.log("Stage 7.3 ambiguity and provenance safety patch applied.");
