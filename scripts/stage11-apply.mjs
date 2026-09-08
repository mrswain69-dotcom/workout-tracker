import fs from "node:fs";

function countOf(text, needle) {
  return needle ? text.split(needle).length - 1 : 0;
}

function replaceExact(text, needle, replacement, label, expectedCount = 1) {
  const count = countOf(text, needle);
  if (count !== expectedCount) {
    throw new Error(`${label}: expected ${expectedCount} match(es), found ${count}`);
  }
  return text.replace(needle, replacement);
}

function patchFile(path, patcher) {
  const before = fs.readFileSync(path, "utf8");
  const after = patcher(before);
  if (after === before) throw new Error(`${path}: patch made no changes`);
  fs.writeFileSync(path, after);
}

patchFile("src/engine/sessionEngine.js", (text) => {
  const marker = `}\n\nfunction normaliseResultBucket(method, rawBucket = {}, config = {}) {`;
  const inserted = `}\n\nfunction normaliseNullableDurationSec(value) {\n  if (value === null || value === undefined || value === "") return null;\n  const n = Number(value);\n  if (!Number.isFinite(n)) return null;\n  return Math.max(0, Math.round(n));\n}\n\nfunction getPlanBlockTemplateId(block) {\n  return cleanText(\n    valueOf(block, "sessionTemplateId", "session_template_id"),\n    ""\n  );\n}\n\nfunction getPlanBlockTemplateNameSnapshot(block) {\n  return cleanText(\n    valueOf(\n      block,\n      "sessionTemplateNameSnapshot",\n      "session_template_name_snapshot"\n    ),\n    ""\n  );\n}\n\nfunction getPlanBlockDurationOverride(block) {\n  return normaliseNullableDurationSec(\n    valueOf(\n      block,\n      "plannedDurationSecOverride",\n      "planned_duration_sec_override",\n      null\n    )\n  );\n}\n\nfunction formatSessionSnapshotName(session) {\n  if (!session || typeof session !== "object") return "";\n  const name = cleanText(session.name, "Session");\n  const code = cleanText(session.displayCode, "");\n  return code ? \`Session \${code} — \${name}\` : name;\n}\n\n/**\n * Convert the lightweight weekly Plan reference into the Session-shaped log\n * block contract. If the definition library is not available yet, the stable\n * template reference and display snapshots are still retained and session is\n * left null so it can be hydrated before persistence.\n */\nexport function buildSessionLogBlockSnapshot(planBlock = {}, library = {}) {\n  const templateId = getPlanBlockTemplateId(planBlock);\n  const durationOverride = getPlanBlockDurationOverride(planBlock);\n  const session = templateId ? buildSessionSnapshot(templateId, library) : null;\n\n  if (session && durationOverride !== null) {\n    session.plannedDurationSec = durationOverride;\n  }\n\n  const rawNote = valueOf(planBlock, "note", "note", "");\n  const nameSnapshot =\n    getPlanBlockTemplateNameSnapshot(planBlock) ||\n    formatSessionSnapshotName(session);\n\n  return {\n    id: cleanText(valueOf(planBlock, "id", "id"), ""),\n    typeId: "session",\n    label: cleanText(valueOf(planBlock, "label", "label"), ""),\n    note: typeof rawNote === "string" ? rawNote : "",\n    sessionTemplateId: templateId,\n    sessionTemplateNameSnapshot: nameSnapshot,\n    plannedDurationSecOverride: durationOverride,\n    session,\n  };\n}\n\n/**\n * Reconcile a planned Session block into an existing daily log. Once a real\n * Session snapshot exists it is authoritative and is never refreshed from the\n * current Plan or Session Library. An unresolved historical block also keeps\n * its original template/name/duration anchors while waiting for hydration.\n */\nexport function reconcileSessionLogBlockSnapshot(\n  plannedBlock = {},\n  existingBlock = null,\n  library = {}\n) {\n  const existing =\n    existingBlock && typeof existingBlock === "object" ? existingBlock : null;\n\n  if (existing?.session && typeof existing.session === "object") {\n    return {\n      ...existing,\n      id: cleanText(existing.id, cleanText(plannedBlock?.id, "")),\n      typeId: "session",\n      session: existing.session,\n    };\n  }\n\n  const existingTemplateId = getPlanBlockTemplateId(existing);\n  const anchored = !!existingTemplateId;\n\n  const source = {\n    ...(plannedBlock || {}),\n    ...(anchored && hasOwn(existing, "label")\n      ? { label: existing.label }\n      : {}),\n    ...(anchored && hasOwn(existing, "note")\n      ? { note: existing.note }\n      : {}),\n    ...(anchored\n      ? { sessionTemplateId: existingTemplateId }\n      : {}),\n    ...(anchored && hasOwn(existing, "sessionTemplateNameSnapshot")\n      ? {\n          sessionTemplateNameSnapshot:\n            existing.sessionTemplateNameSnapshot,\n        }\n      : {}),\n    ...(anchored && hasOwn(existing, "plannedDurationSecOverride")\n      ? {\n          plannedDurationSecOverride:\n            existing.plannedDurationSecOverride,\n        }\n      : {}),\n  };\n\n  const built = buildSessionLogBlockSnapshot(source, library);\n\n  return {\n    ...(existing || {}),\n    ...built,\n    id:\n      cleanText(existing?.id, "") ||\n      cleanText(plannedBlock?.id, "") ||\n      built.id,\n    typeId: "session",\n    session: built.session || null,\n  };\n}\n\n/**\n * Hydrate only Session blocks that do not yet have a frozen definition. This\n * is deliberately idempotent: existing snapshots/results are returned intact.\n */\nexport function hydrateSessionSnapshotsInLog(log, library = {}) {\n  if (!log || !Array.isArray(log.blocks)) return log;\n\n  let changed = false;\n  const blocks = log.blocks.map((block) => {\n    if (!block || block.typeId !== "session") return block;\n    if (block.session && typeof block.session === "object") return block;\n\n    const next = reconcileSessionLogBlockSnapshot(block, block, library);\n    if (next.session && typeof next.session === "object") changed = true;\n    return next;\n  });\n\n  return changed ? { ...log, blocks } : log;\n}\n\nfunction normaliseResultBucket(method, rawBucket = {}, config = {}) {`;

  return replaceExact(text, marker, inserted, "sessionEngine Stage 11 helpers");
});

patchFile("src/engine/sessionEngine.test.js", (text) => {
  text = replaceExact(
    text,
    `  buildSessionSnapshot,\n  getAttemptSuccessTotals,`,
    `  buildSessionLogBlockSnapshot,\n  buildSessionSnapshot,\n  getAttemptSuccessTotals,\n  hydrateSessionSnapshotsInLog,`,
    "sessionEngine Stage 11 imports A"
  );

  text = replaceExact(
    text,
    `  normaliseMovementResult,\n  sessionHasActivity,`,
    `  normaliseMovementResult,\n  reconcileSessionLogBlockSnapshot,\n  sessionHasActivity,`,
    "sessionEngine Stage 11 imports B"
  );

  const marker = `describe("movement result normalisation", () => {`;
  const tests = `describe("Session Plan-to-log snapshot reconciliation", () => {\n  it("builds the daily Session block from the lightweight Plan reference", () => {\n    const library = makeLibrary();\n    const block = buildSessionLogBlockSnapshot(\n      {\n        id: "plan-session-a",\n        typeId: "session",\n        label: "Tuesday ball work",\n        note: "Sharp touches",\n        sessionTemplateId: "session-a",\n        sessionTemplateNameSnapshot: "Session A — Close Control",\n        plannedDurationSecOverride: 750,\n      },\n      library\n    );\n\n    expect(block.id).toBe("plan-session-a");\n    expect(block.sessionTemplateId).toBe("session-a");\n    expect(block.sessionTemplateNameSnapshot).toBe("Session A — Close Control");\n    expect(block.plannedDurationSecOverride).toBe(750);\n    expect(block.session.templateId).toBe("session-a");\n    expect(block.session.templateVersion).toBe(1);\n    expect(block.session.plannedDurationSec).toBe(750);\n    expect(block.session.movements[0].displayLabel).toBe("Sole Rolls");\n  });\n\n  it("never replaces an existing frozen Session snapshot with a newer template", () => {\n    const library = makeLibrary();\n    const original = buildSessionLogBlockSnapshot(\n      {\n        id: "plan-session",\n        typeId: "session",\n        label: "Original label",\n        note: "Original note",\n        sessionTemplateId: "session-a",\n        sessionTemplateNameSnapshot: "Session A — Close Control",\n      },\n      library\n    );\n    original.session.movements[0].completed = true;\n    original.session.movements[0].result = { overall: { count: 33 } };\n\n    library.templates[0].name = "Close Control v2";\n    library.templates[0].version = 2;\n    library.templateMovements[0].display_label = "Renamed Sole Rolls";\n\n    const reconciled = reconcileSessionLogBlockSnapshot(\n      {\n        id: "plan-session",\n        typeId: "session",\n        label: "Current plan label",\n        note: "Current plan note",\n        sessionTemplateId: "session-b",\n        sessionTemplateNameSnapshot: "Session B — First Touch & Protection",\n      },\n      original,\n      library\n    );\n\n    expect(reconciled.label).toBe("Original label");\n    expect(reconciled.note).toBe("Original note");\n    expect(reconciled.session.templateId).toBe("session-a");\n    expect(reconciled.session.templateVersion).toBe(1);\n    expect(reconciled.session.name).toBe("Close Control");\n    expect(reconciled.session.movements[0].displayLabel).toBe("Sole Rolls");\n    expect(reconciled.session.movements[0].result).toEqual({\n      overall: { count: 33 },\n    });\n  });\n\n  it("anchors an unresolved historical block to its originally saved template reference", () => {\n    const library = makeLibrary();\n    const unresolved = buildSessionLogBlockSnapshot({\n      id: "plan-session",\n      typeId: "session",\n      label: "Saved label",\n      note: "Saved note",\n      sessionTemplateId: "session-a",\n      sessionTemplateNameSnapshot: "Session A — Close Control",\n      plannedDurationSecOverride: 600,\n    });\n\n    expect(unresolved.session).toBeNull();\n\n    const reconciled = reconcileSessionLogBlockSnapshot(\n      {\n        id: "plan-session",\n        typeId: "session",\n        label: "New plan label",\n        sessionTemplateId: "session-b",\n        sessionTemplateNameSnapshot: "Session B — First Touch & Protection",\n        plannedDurationSecOverride: 900,\n      },\n      unresolved,\n      library\n    );\n\n    expect(reconciled.label).toBe("Saved label");\n    expect(reconciled.note).toBe("Saved note");\n    expect(reconciled.sessionTemplateId).toBe("session-a");\n    expect(reconciled.sessionTemplateNameSnapshot).toBe("Session A — Close Control");\n    expect(reconciled.plannedDurationSecOverride).toBe(600);\n    expect(reconciled.session.templateId).toBe("session-a");\n    expect(reconciled.session.plannedDurationSec).toBe(600);\n  });\n\n  it("hydrates missing Session snapshots without changing unrelated blocks", () => {\n    const library = makeLibrary();\n    const unresolved = buildSessionLogBlockSnapshot({\n      id: "plan-session",\n      typeId: "session",\n      sessionTemplateId: "session-c",\n      sessionTemplateNameSnapshot: "Session C — Direction & Weak Foot",\n    });\n    const strengthBlock = {\n      id: "strength-1",\n      typeId: "strength",\n      sets: { squat: [{ reps: 10 }] },\n    };\n    const log = {\n      weekday: "Tue",\n      blocks: [strengthBlock, unresolved],\n    };\n\n    const hydrated = hydrateSessionSnapshotsInLog(log, library);\n\n    expect(hydrated).not.toBe(log);\n    expect(hydrated.blocks[0]).toBe(strengthBlock);\n    expect(hydrated.blocks[1].session.templateId).toBe("session-c");\n    expect(hydrated.blocks[1].session.movements).toHaveLength(2);\n  });\n\n  it("is idempotent for a log that already contains a frozen Session snapshot", () => {\n    const library = makeLibrary();\n    const frozen = buildSessionLogBlockSnapshot(\n      {\n        id: "plan-session",\n        typeId: "session",\n        sessionTemplateId: "session-a",\n      },\n      library\n    );\n    const log = { blocks: [frozen] };\n\n    library.templates[0].name = "Later edit";\n    library.templates[0].version = 99;\n\n    const hydrated = hydrateSessionSnapshotsInLog(log, library);\n\n    expect(hydrated).toBe(log);\n    expect(hydrated.blocks[0].session.name).toBe("Close Control");\n    expect(hydrated.blocks[0].session.templateVersion).toBe(1);\n  });\n});\n\n${marker}`;

  return replaceExact(text, marker, tests, "sessionEngine Stage 11 tests");
});

patchFile("src/App.jsx", (text) => {
  text = replaceExact(
    text,
    `  deletePlanTemplate,\n  setFamilyPinHash,`,
    `  deletePlanTemplate,\n  loadSessionLibrary,\n  setFamilyPinHash,`,
    "App loadSessionLibrary import"
  );

  text = replaceExact(
    text,
    `import { buildBadgeStatsV2 } from "./engine/badgeStatsV2";\n\nimport { AVATAR_PACKS } from "./config/avatars";`,
    `import { buildBadgeStatsV2 } from "./engine/badgeStatsV2";\nimport {\n  buildSessionLogBlockSnapshot,\n  hydrateSessionSnapshotsInLog,\n  reconcileSessionLogBlockSnapshot,\n} from "./engine/sessionEngine.js";\n\nimport { AVATAR_PACKS } from "./config/avatars";`,
    "App Session snapshot engine imports"
  );

  text = replaceExact(
    text,
    `  // Normalise what we store\n  const logToStore = nextLog ? stampLogTiming(logForDay, { ...nextLog }) : null;`,
    `  // Resolve any newly planned Session blocks into immutable definition snapshots\n  // before the log is persisted. Existing block.session snapshots are never refreshed.\n  let preparedLog = nextLog ? { ...nextLog } : null;\n\n  const hasUnresolvedSessionSnapshot =\n    !!preparedLog &&\n    Array.isArray(preparedLog.blocks) &&\n    preparedLog.blocks.some(\n      (b) => b && b.typeId === "session" && !b.session\n    );\n\n  if (hasUnresolvedSessionSnapshot && familyId) {\n    try {\n      const { data: sessionLibrary, error: sessionLibraryError } =\n        await loadSessionLibrary(familyId, { includeArchived: true });\n\n      if (sessionLibraryError) {\n        console.warn(\n          "Session snapshot library load failed; keeping the saved template anchor for retry",\n          sessionLibraryError\n        );\n      } else {\n        preparedLog = hydrateSessionSnapshotsInLog(\n          preparedLog,\n          sessionLibrary || {}\n        );\n      }\n    } catch (sessionSnapshotError) {\n      console.warn(\n        "Session snapshot hydration failed; keeping the saved template anchor for retry",\n        sessionSnapshotError\n      );\n    }\n  }\n\n  const logToStore = preparedLog\n    ? stampLogTiming(logForDay, preparedLog)\n    : null;`,
    "App saveLog Session hydration"
  );

  text = replaceExact(
    text,
    `            blocks: plannedBlocks.map((b) => ({\n      id: b.id,`,
    `            blocks: plannedBlocks.map((b) =>\n      b?.typeId === "session"\n        ? {\n            ...buildSessionLogBlockSnapshot(b),\n            cardio: {\n              distanceKm: "",\n              durationMin: "",\n              avgSpeedKmh: "",\n            },\n            duration: {\n              minutes: "",\n            },\n          }\n        : ({\n      id: b.id,`,
    "App blankLogForDay Session block"
  );

  text = replaceExact(
    text,
    `    const existing = existingById.get(pb.id);\n\n    const baseCardio =`,
    `    const existing = existingById.get(pb.id);\n\n    if (pb.typeId === "session") {\n      const sessionBlock = reconcileSessionLogBlockSnapshot(pb, existing);\n      const sessionCardio =\n        existing && existing.cardio && typeof existing.cardio === "object"\n          ? existing.cardio\n          : { distanceKm: "", durationMin: "", avgSpeedKmh: "" };\n      const sessionDuration =\n        existing && existing.duration && typeof existing.duration === "object"\n          ? existing.duration\n          : { minutes: "" };\n\n      mergedBlocks.push({\n        ...sessionBlock,\n        cardio: sessionCardio,\n        duration: sessionDuration,\n      });\n\n      existingById.delete(pb.id);\n      continue;\n    }\n\n    const baseCardio =`,
    "App ensureBlocksSnapshot Session freeze guard"
  );

  return text;
});

console.log("Stage 11 snapshot patch applied successfully.");
