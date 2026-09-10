import { describe, expect, it } from "vitest";
import {
  SESSION_SNAPSHOT_SCHEMA_VERSION,
  buildSessionSnapshot,
} from "./sessionEngine.js";

function library() {
  return {
    programmes: [{ id: "programme", name: "Skills" }],
    movements: [{ id: "receive", name: "Outside-foot receive" }],
    templates: [
      {
        id: "session-b",
        programme_id: "programme",
        display_code: "B",
        name: "Receiving",
        planned_duration_sec: 900,
        version: 1,
      },
    ],
    templateMovements: [
      {
        id: "row-1",
        session_template_id: "session-b",
        movement_id: "receive",
        position: 1,
        tracking_method: "repetitions",
        tracking_config: {},
      },
    ],
    movementDevelopmentTags: [
      { movement_id: "receive", development_tag_id: "receiving" },
      { movementId: "receive", developmentTagId: "first-touch" },
      { movement_id: "receive", development_tag_id: "receiving" },
    ],
  };
}

describe("Phase 4 Stage 1 Session analysis snapshot", () => {
  it("bumps the Session snapshot schema and freezes sorted deduplicated Movement Development Tags", () => {
    const source = library();
    const snapshot = buildSessionSnapshot("session-b", source);

    expect(SESSION_SNAPSHOT_SCHEMA_VERSION).toBe(2);
    expect(snapshot.schemaVersion).toBe(2);
    expect(snapshot.movements[0].developmentTagIds).toEqual([
      "first-touch",
      "receiving",
    ]);
  });

  it("keeps the frozen tag relationship unchanged after the live taxonomy is edited", () => {
    const source = library();
    const snapshot = buildSessionSnapshot("session-b", source);

    source.movementDevelopmentTags.length = 0;
    source.movementDevelopmentTags.push({
      movement_id: "receive",
      development_tag_id: "different-later-tag",
    });

    expect(snapshot.movements[0].developmentTagIds).toEqual([
      "first-touch",
      "receiving",
    ]);
  });

  it("stores an explicit empty tag list when the Movement had no Development Tags at snapshot time", () => {
    const source = library();
    source.movementDevelopmentTags = [];
    const snapshot = buildSessionSnapshot("session-b", source);
    expect(snapshot.movements[0].developmentTagIds).toEqual([]);
  });
});
