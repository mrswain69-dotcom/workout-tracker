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

const appPath = "src/App.jsx";
let app = fs.readFileSync(appPath, "utf8");

app = replaceExact(
  app,
  `} from "./engine/sessionEngine.js";\n\nimport { AVATAR_PACKS }`,
  `} from "./engine/sessionEngine.js";\nimport {\n  SESSION_COMPLETION_XP,\n  getSessionBlockLoadScore,\n  getSessionBlockTrainingMinutes,\n  getSessionBlockXp,\n  sessionBlockHasActivity,\n  sessionBlockIsComplete,\n} from "./engine/sessionCore.js";\n\nimport { AVATAR_PACKS }`,
  "Session core App import"
);

// App green-day and same-day completion both use the same completion-only rule.
app = replaceExact(
  app,
  `    } else if (typeId === "recovery") {\n      hasData = !!block?.recoveryDone;\n    }`,
  `    } else if (typeId === "session") {\n      hasData = sessionBlockIsComplete(block);\n    } else if (typeId === "recovery") {\n      hasData = !!block?.recoveryDone;\n    }`,
  "Session completion in green/same-day checks",
  2
);

app = replaceExact(
  app,
  `  // 2) New model: sum minutes from per-block cardio + duration\n  let blockCardioMin = 0;\n  let blockDurationMin = 0;`,
  `  // 2) New model: sum minutes from per-block cardio + duration + structured Sessions\n  let blockCardioMin = 0;\n  let blockDurationMin = 0;\n  let blockSessionMin = 0;`,
  "Session minutes accumulator"
);

app = replaceExact(
  app,
  `      if (b.duration && typeof b.duration === "object") {\n        // duration blocks use duration.minutes\n        blockDurationMin += safeNumber(b.duration.minutes);\n      }`,
  `      if (b.duration && typeof b.duration === "object") {\n        // duration blocks use duration.minutes\n        blockDurationMin += safeNumber(b.duration.minutes);\n      }\n\n      if (b.typeId === "session") {\n        blockSessionMin += getSessionBlockTrainingMinutes(b);\n      }`,
  "Session minutes per block"
);

app = replaceExact(
  app,
  `  if (blockCardioMin > 0 || blockDurationMin > 0) {\n    // e.g. 5 km / 25 min run + 20 min yoga = 45\n    return blockCardioMin + blockDurationMin;\n  }`,
  `  if (blockCardioMin > 0 || blockDurationMin > 0 || blockSessionMin > 0) {\n    // e.g. 25 min run + 20 min yoga + 15 min skill Session = 60\n    return blockCardioMin + blockDurationMin + blockSessionMin;\n  }`,
  "Session total minutes"
);

app = replaceExact(
  app,
  `  if (typeId === "duration") {\n    return safeNumber(block?.duration?.minutes) > 0;\n  }\n\n  return false;\n}\n\nfunction hasRecoveryDoneForLog`,
  `  if (typeId === "duration") {\n    return safeNumber(block?.duration?.minutes) > 0;\n  }\n\n  if (typeId === "session") {\n    return sessionBlockHasActivity(block);\n  }\n\n  return false;\n}\n\nfunction hasRecoveryDoneForLog`,
  "Session recovery training-day detection"
);

app = replaceExact(
  app,
  `  if (typeId === "duration") {\n    const mins = safeNumber(block?.duration?.minutes);\n    return Math.round(mins * 0.7);\n  }\n\n  if (typeId === "tasks" || typeId === "recovery") {`,
  `  if (typeId === "duration") {\n    const mins = safeNumber(block?.duration?.minutes);\n    return Math.round(mins * 0.7);\n  }\n\n  if (typeId === "session") {\n    return getSessionBlockLoadScore(block);\n  }\n\n  if (typeId === "tasks" || typeId === "recovery") {`,
  "Session readiness load score"
);

app = replaceExact(
  app,
  `    if (load > 0) hadTraining = true;\n    if (typeId === "recovery" && b.recoveryDone) hadRecovery = true;`,
  `    if (load > 0 || (typeId === "session" && sessionBlockHasActivity(b))) {\n      hadTraining = true;\n    }\n    if (typeId === "recovery" && b.recoveryDone) hadRecovery = true;`,
  "Partial Session readiness activity"
);

app = replaceExact(
  app,
  `    } else if (typeId === "duration") {\n      cardioEnergyLoad += load * 0.6;\n      nervousLoad += load * 0.25;\n    }\n  }`,
  `    } else if (typeId === "duration") {\n      cardioEnergyLoad += load * 0.6;\n      nervousLoad += load * 0.25;\n    } else if (typeId === "session") {\n      // Skill Sessions are moderate physical work with a meaningful coordination load.\n      nervousLoad += load * 0.65;\n      cardioEnergyLoad += load * 0.55;\n    }\n  }`,
  "Session readiness load allocation"
);

app = replaceExact(
  app,
  `    if (typeId === "duration") {\n      return safeNumber(b?.duration?.minutes) > 0;\n    }\n\n    if (typeId === "recovery") {`,
  `    if (typeId === "duration") {\n      return safeNumber(b?.duration?.minutes) > 0;\n    }\n\n    if (typeId === "session") {\n      return sessionBlockHasActivity(b);\n    }\n\n    if (typeId === "recovery") {`,
  "Session readiness timestamp detection"
);

app = replaceExact(
  app,
  `  durationPerMin: 2 / 10,    // +2 XP per 10 minutes\n  taskDefault: 5,`,
  `  durationPerMin: 2 / 10,    // +2 XP per 10 minutes\n  sessionComplete: SESSION_COMPLETION_XP, // fixed total XP for a completed structured Session\n  taskDefault: 5,`,
  "Session XP rule"
);

app = replaceExact(
  app,
  `  if (typeId === "recovery") {\n    return !!block.recoveryDone;\n  }\n\n  if (typeId === "tasks") {`,
  `  if (typeId === "recovery") {\n    return !!block.recoveryDone;\n  }\n\n  if (typeId === "session") {\n    return sessionBlockHasActivity(block);\n  }\n\n  if (typeId === "tasks") {`,
  "Session generic activity detection"
);

app = replaceExact(
  app,
  `      case "recovery": {\n        const blockXp = xpForRecoveryBlock(block);`,
  `      case "session": {\n        // Session XP is completion-only and already represents the whole block.\n        total += getSessionBlockXp(block);\n        break;\n      }\n      case "recovery": {\n        const blockXp = xpForRecoveryBlock(block);`,
  "Session base XP switch"
);

app = replaceExact(
  app,
  `    let durationXp = 0;\n    let recoveryXp = 0;\nlet tasksXp = 0;`,
  `    let durationXp = 0;\n    let sessionXp = 0;\n    let recoveryXp = 0;\nlet tasksXp = 0;`,
  "Session XP debug bucket"
);

app = replaceExact(
  app,
  `        case "recovery": {\n          const blockXp = xpForRecoveryBlock(block);`,
  `        case "session": {\n          sessionXp += getSessionBlockXp(block);\n          break;\n        }\n\n        case "recovery": {\n          const blockXp = xpForRecoveryBlock(block);`,
  "Session XP debug switch"
);

app = replaceExact(
  app,
  `const nonBonusXp = strengthXp + cardioXp + durationXp + recoveryXp + tasksXp + dayCompleteXp;`,
  `const nonBonusXp = strengthXp + cardioXp + durationXp + sessionXp + recoveryXp + tasksXp + dayCompleteXp;`,
  "Session XP in non-bonus total"
);

app = replaceExact(
  app,
  `  cardioXp,\n  durationXp,\n  recoveryXp,`,
  `  cardioXp,\n  durationXp,\n  sessionXp,\n  recoveryXp,`,
  "Session XP debug row"
);

app = replaceExact(
  app,
  `      cardioXp: 0,\n      durationXp: 0,\n      tasksXp: 0,`,
  `      cardioXp: 0,\n      durationXp: 0,\n      sessionXp: 0,\n      tasksXp: 0,`,
  "Synthetic XP row Session bucket"
);

app = replaceExact(
  app,
  `      } else if (typeId === "duration") {\n        const mins = safeNumber(b?.duration?.minutes);\n        if (mins > 0) {\n          didAnything = true;\n          w.durationMin += mins;\n          w.durationBlocks += 1;\n          dayDurationMin += mins;\n        }\n      } else if (typeId === "tasks") {`,
  `      } else if (typeId === "duration") {\n        const mins = safeNumber(b?.duration?.minutes);\n        if (mins > 0) {\n          didAnything = true;\n          w.durationMin += mins;\n          w.durationBlocks += 1;\n          dayDurationMin += mins;\n        }\n      } else if (typeId === "session") {\n        if (sessionBlockHasActivity(b)) {\n          didAnything = true;\n          const mins = getSessionBlockTrainingMinutes(b);\n          if (mins > 0) {\n            w.durationMin += mins;\n            dayDurationMin += mins;\n          }\n        }\n      } else if (typeId === "tasks") {`,
  "Session activity in aggregate stats"
);

app = replaceExact(
  app,
  `<div><b>Duration:</b> XP from minutes (2 XP per 10 minutes, plus 5 XP per logged duration block)</div>\n                <div><b>Tasks:</b>`,
  `<div><b>Duration:</b> XP from minutes (2 XP per 10 minutes, plus 5 XP per logged duration block)</div>\n                <div><b>Sessions:</b> +10 XP when a structured Session is completed. Drill counts/results do not add XP.</div>\n                <div><b>Tasks:</b>`,
  "Session XP help copy"
);

app = replaceExact(
  app,
  `      <th style={{ textAlign: "right" }}>Duration</th>\n      <th style={{ textAlign: "right" }}>Tasks</th>`,
  `      <th style={{ textAlign: "right" }}>Duration</th>\n      <th style={{ textAlign: "right" }}>Session</th>\n      <th style={{ textAlign: "right" }}>Tasks</th>`,
  "Session XP ledger header"
);

app = replaceExact(
  app,
  `<td style={{ textAlign: "right" }}>{r.durationXp || 0}</td>\n<td style={{ textAlign: "right" }}>{r.tasksXp || 0}</td>`,
  `<td style={{ textAlign: "right" }}>{r.durationXp || 0}</td>\n<td style={{ textAlign: "right" }}>{r.sessionXp || 0}</td>\n<td style={{ textAlign: "right" }}>{r.tasksXp || 0}</td>`,
  "Session XP ledger cell"
);

app = replaceExact(
  app,
  `Tip: “Non-bonus” = Strength + Cardio + Duration + Tasks + Day. Bonuses are Daily, Prog, Streak and Badges.`,
  `Tip: “Non-bonus” = Strength + Cardio + Duration + Session + Tasks + Day. Bonuses are Daily, Prog, Streak and Badges.`,
  "Session XP ledger tip"
);

fs.writeFileSync(appPath, app);

const badgePath = "src/engine/badgeStatsV2.js";
let badge = fs.readFileSync(badgePath, "utf8");

badge = replaceExact(
  badge,
  `// src/engine/badgeStatsV2.js\n//`,
  `// src/engine/badgeStatsV2.js\nimport {\n  sessionBlockHasActivity,\n  sessionBlockIsComplete,\n} from "./sessionCore.js";\n\n//`,
  "Session core badge import"
);

badge = replaceExact(
  badge,
  `  if (typeId === "duration") {\n    return safeNum(block?.duration?.minutes) > 0;\n  }\n\n  return false;\n}\n\nfunction hasRecoveryDone`,
  `  if (typeId === "duration") {\n    return safeNum(block?.duration?.minutes) > 0;\n  }\n\n  if (typeId === "session") {\n    return sessionBlockHasActivity(block);\n  }\n\n  return false;\n}\n\nfunction hasRecoveryDone`,
  "Session badge recovery training detection"
);

badge = replaceExact(
  badge,
  `    } else if (typeId === "duration") {\n      hasData = safeNum(b?.duration?.minutes) > 0;\n       } else if (typeId === "recovery") {`,
  `    } else if (typeId === "duration") {\n      hasData = safeNum(b?.duration?.minutes) > 0;\n    } else if (typeId === "session") {\n      hasData = sessionBlockHasActivity(b);\n    } else if (typeId === "recovery") {`,
  "Session behaviour badge activity"
);

badge = replaceExact(
  badge,
  `    } else if (typeId === "duration") {\n      hasData = safeNum(block?.duration?.minutes) > 0;\n    } else if (typeId === "recovery") {`,
  `    } else if (typeId === "duration") {\n      hasData = safeNum(block?.duration?.minutes) > 0;\n    } else if (typeId === "session") {\n      hasData = sessionBlockIsComplete(block);\n    } else if (typeId === "recovery") {`,
  "Session badge streak completion"
);

badge = replaceExact(
  badge,
  `      typeId !== "bike" &&\n      typeId !== "duration"\n    ) {`,
  `      typeId !== "bike" &&\n      typeId !== "duration" &&\n      typeId !== "session"\n    ) {`,
  "Session sport mastery accepted block type"
);

badge = replaceExact(
  badge,
  `    } else if (typeId === "duration") {\n      hasData = safeNum(b?.duration?.minutes) > 0;\n    }\n\n    if (!hasData) continue;`,
  `    } else if (typeId === "duration") {\n      hasData = safeNum(b?.duration?.minutes) > 0;\n    } else if (typeId === "session") {\n      hasData = sessionBlockHasActivity(b);\n    }\n\n    if (!hasData) continue;`,
  "Session sport mastery activity"
);

badge = replaceExact(
  badge,
  `      const candidates = [\n        b?.activityName,\n        b?.label,\n        b?.note,\n        b?.cardioTypeOtherLabel,\n      ];`,
  `      const candidates = [\n        b?.activityName,\n        b?.session?.programmeName,\n        b?.session?.name,\n        b?.session?.description,\n        b?.label,\n        b?.note,\n        b?.cardioTypeOtherLabel,\n      ];`,
  "Session sport mastery identity"
);

fs.writeFileSync(badgePath, badge);
console.log("Stage 13 core Session engine integration patch applied successfully.");
