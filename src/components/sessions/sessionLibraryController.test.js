import { describe, expect, it, vi } from "vitest";
import {
  activeSessionsInProgramme,
  activeSessionsUsingMovement,
  getProgrammeSessions,
  getTemplateDefinition,
  normaliseSessionLibrary,
  persistSessionDefinition,
  sessionDefinitionChanged,
  sessionDefinitionFingerprint,
  toEditorTemplate,
  toEditorTemplateMovement,
} from "./sessionLibraryController.js";

function libraryFixture() {
  return {
    programmes: [
      { id: "p2", name: "Speed", sort_order: 2 },
      { id: "p1", name: "Football Skills", sort_order: 1 },
    ],
    movements: [
      { id: "m2", name: "Drag-Backs" },
      { id: "m1", name: "Sole Rolls" },
      { id: "m3", name: "Keepy-Uppys" },
    ],
    templates: [
      {
        id: "t2",
        programme_id: "p1",
        display_code: "B",
        name: "First Touch",
        version: 1,
        sort_order: 2,
      },
      {
        id: "t1",
        programme_id: "p1",
        display_code: "A",
        name: "Close Control",
        version: 3,
        planned_duration_sec: 900,
        sort_order: 1,
      },
      {
        id: "t3",
        programme_id: "p2",
        display_code: "A",
        name: "Acceleration",
        version: 1,
        sort_order: 1,
      },
    ],
    templateMovements: [
      {
        id: "tm2",
        family_id: "f1",
        session_template_id: "t1",
        movement_id: "m2",
        position: 2,
        display_label: "Drag-Backs",
        planned_duration_sec: 150,
        tracking_method: "repetitions",
        tracking_config: { countLabel: "Clean reps" },
      },
      {
        id: "tm1",
        family_id: "f1",
        session_template_id: "t1",
        movement_id: "m1",
        position: 1,
        display_label: "Sole Rolls",
        planned_duration_sec: 150,
        tracking_method: "repetitions",
        tracking_config: { countLabel: "Clean reps" },
      },
      {
        id: "tm3",
        family_id: "f1",
        session_template_id: "t2",
        movement_id: "m1",
        position: 1,
        display_label: "Sole Rolls",
        tracking_method: "completion",
        tracking_config: {},
      },
    ],
    developmentTags: [],
    movementDevelopmentTags: [],
  };
}

function definitionFixture() {
  return {
    template: {
      id: "t1",
      programmeId: "p1",
      displayCode: "A",
      name: "Close Control",
      description: "Technical work",
      plannedDurationSec: 300,
      version: 3,
      sortOrder: 8,
    },
    templateMovements: [
      {
        id: "tm1",
        sessionTemplateId: "t1",
        movementId: "m1",
        position: 1,
        displayLabel: "Sole Rolls",
        instructions: "Fast feet",
        plannedDurationSec: 150,
        trackingMethod: "repetitions",
        trackingConfig: { countLabel: "Clean reps" },
      },
      {
        id: "tm2",
        sessionTemplateId: "t1",
        movementId: "m2",
        position: 2,
        displayLabel: "Drag-Backs",
        instructions: "Stay low",
        plannedDurationSec: 150,
        trackingMethod: "repetitions",
        trackingConfig: { countLabel: "Clean reps" },
      },
    ],
  };
}

function mockDb() {
  return {
    createSessionTemplate: vi.fn(async (_familyId, template) => ({
      data: { id: "new-template", ...template },
      error: null,
    })),
    updateSessionTemplate: vi.fn(async (id, patch) => ({
      data: { id, ...patch },
      error: null,
    })),
    createSessionTemplateMovement: vi.fn(async (_familyId, row) => ({
      data: { id: `new-${row.position}`, ...row },
      error: null,
    })),
    updateSessionTemplateMovement: vi.fn(async (id, patch) => ({
      data: { id, ...patch },
      error: null,
    })),
    deleteSessionTemplateMovement: vi.fn(async () => ({ error: null })),
  };
}

describe("Session Library controller helpers", () => {
  it("normalises and sorts database rows for the library", () => {
    const safe = normaliseSessionLibrary(libraryFixture());
    expect(safe.programmes.map((item) => item.id)).toEqual(["p1", "p2"]);
    expect(safe.movements.map((item) => item.id)).toEqual(["m2", "m3", "m1"]);
    expect(getProgrammeSessions(safe, "p1").map((item) => item.id)).toEqual(["t1", "t2"]);
  });

  it("maps snake_case template and movement rows into the editor contract", () => {
    expect(
      toEditorTemplate({
        id: "t1",
        programme_id: "p1",
        display_code: "A",
        planned_duration_sec: 900,
        version: 4,
      })
    ).toEqual(
      expect.objectContaining({
        id: "t1",
        programmeId: "p1",
        displayCode: "A",
        plannedDurationSec: 900,
        version: 4,
      })
    );

    expect(
      toEditorTemplateMovement({
        id: "tm1",
        session_template_id: "t1",
        movement_id: "m1",
        position: 2,
        tracking_method: "attempts_successes",
        tracking_config: { sideMode: "separate" },
      })
    ).toEqual(
      expect.objectContaining({
        id: "tm1",
        sessionTemplateId: "t1",
        movementId: "m1",
        position: 2,
        trackingMethod: "attempts_successes",
        trackingConfig: expect.objectContaining({ sideMode: "separate", required: false }),
      })
    );
  });

  it("builds an editor definition with rows ordered by position", () => {
    const definition = getTemplateDefinition(libraryFixture(), "t1");
    expect(definition.template).toEqual(
      expect.objectContaining({ id: "t1", name: "Close Control", version: 3 })
    );
    expect(definition.templateMovements.map((row) => row.id)).toEqual(["tm1", "tm2"]);
  });

  it("ignores ids, version and library sort order when comparing definition content", () => {
    const original = definitionFixture();
    const cosmetic = {
      template: { ...original.template, id: "different", version: 99, sortOrder: 1 },
      templateMovements: original.templateMovements.map((row, index) => ({
        ...row,
        id: `other-${index}`,
      })),
    };
    expect(sessionDefinitionFingerprint(cosmetic)).toBe(sessionDefinitionFingerprint(original));
    expect(sessionDefinitionChanged(cosmetic, original)).toBe(false);

    const changed = {
      ...original,
      templateMovements: original.templateMovements.map((row, index) =>
        index === 0
          ? { ...row, trackingConfig: { ...row.trackingConfig, sideMode: "separate" } }
          : row
      ),
    };
    expect(sessionDefinitionChanged(changed, original)).toBe(true);
  });

  it("reports active Session usage for Programmes and canonical Movements", () => {
    const library = libraryFixture();
    expect(activeSessionsInProgramme(library, "p1").map((item) => item.id)).toEqual(["t1", "t2"]);
    expect(activeSessionsUsingMovement(library, "m1").map((item) => item.id).sort()).toEqual(["t1", "t2"]);
    expect(activeSessionsUsingMovement(library, "m3")).toEqual([]);
  });
});

describe("persistSessionDefinition", () => {
  it("creates a new Session and its ordered movement rows at version 1", async () => {
    const db = mockDb();
    const definition = {
      template: {
        programmeId: "p1",
        displayCode: "A",
        name: "Close Control",
        plannedDurationSec: 300,
        version: 7,
      },
      templateMovements: [
        {
          movementId: "m1",
          position: 1,
          displayLabel: "Sole Rolls",
          trackingMethod: "repetitions",
          trackingConfig: { countLabel: "Clean reps" },
        },
        {
          movementId: "m2",
          position: 2,
          displayLabel: "Drag-Backs",
          trackingMethod: "completion",
          trackingConfig: {},
        },
      ],
    };

    const saved = await persistSessionDefinition({
      familyId: "f1",
      definition,
      db,
    });

    expect(db.createSessionTemplate).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({ programmeId: "p1", name: "Close Control", version: 1 })
    );
    expect(db.createSessionTemplateMovement).toHaveBeenCalledTimes(2);
    expect(db.createSessionTemplateMovement).toHaveBeenNthCalledWith(
      1,
      "f1",
      expect.objectContaining({ sessionTemplateId: "new-template", movementId: "m1", position: 1 })
    );
    expect(saved).toEqual(expect.objectContaining({ changed: true, created: true }));
  });

  it("does not write anything when an existing definition has not changed", async () => {
    const db = mockDb();
    const definition = definitionFixture();

    const saved = await persistSessionDefinition({
      familyId: "f1",
      definition,
      originalDefinition: definitionFixture(),
      db,
    });

    expect(saved.changed).toBe(false);
    expect(db.updateSessionTemplate).not.toHaveBeenCalled();
    expect(db.updateSessionTemplateMovement).not.toHaveBeenCalled();
    expect(db.createSessionTemplateMovement).not.toHaveBeenCalled();
  });

  it("safely reorders retained rows, removes obsolete rows, creates new rows and bumps version once", async () => {
    const db = mockDb();
    const original = definitionFixture();
    const next = {
      template: { ...original.template, name: "Close Control Plus" },
      templateMovements: [
        { ...original.templateMovements[1], position: 1 },
        {
          movementId: "m3",
          position: 2,
          displayLabel: "Keepy-Uppys",
          trackingMethod: "best_score",
          trackingConfig: { countLabel: "Best" },
        },
      ],
    };

    const saved = await persistSessionDefinition({
      familyId: "f1",
      definition: next,
      originalDefinition: original,
      db,
    });

    expect(db.updateSessionTemplateMovement).toHaveBeenNthCalledWith(
      1,
      "tm2",
      { position: 100001 }
    );
    expect(db.deleteSessionTemplateMovement).toHaveBeenCalledWith("tm1");
    expect(db.updateSessionTemplateMovement).toHaveBeenCalledWith(
      "tm2",
      expect.objectContaining({ position: 1, movementId: "m2" })
    );
    expect(db.createSessionTemplateMovement).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({ sessionTemplateId: "t1", movementId: "m3", position: 2 })
    );
    expect(db.updateSessionTemplate).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ name: "Close Control Plus", version: 4 })
    );
    expect(saved).toEqual(expect.objectContaining({ changed: true, created: false }));
  });

  it("stops immediately when a DB operation reports an error", async () => {
    const db = mockDb();
    db.createSessionTemplate.mockResolvedValue({ data: null, error: new Error("database unavailable") });

    await expect(
      persistSessionDefinition({
        familyId: "f1",
        definition: {
          template: { programmeId: "p1", name: "A" },
          templateMovements: [{ movementId: "m1", position: 1, trackingMethod: "completion" }],
        },
        db,
      })
    ).rejects.toThrow("Could not create Session: database unavailable");

    expect(db.createSessionTemplateMovement).not.toHaveBeenCalled();
  });
});
