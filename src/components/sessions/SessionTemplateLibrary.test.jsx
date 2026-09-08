// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./SessionTemplateEditor.jsx", async () => {
  const ReactModule = await import("react");
  return {
    default: function MockSessionTemplateEditor({
      template,
      templateMovements,
      canonicalMovements,
      onSave,
      onCancel,
      saving,
    }) {
      const isExisting = !!template?.id;
      const nextRows = templateMovements?.length
        ? templateMovements
        : [
            {
              movementId: canonicalMovements?.[0]?.id || "",
              position: 1,
              displayLabel: canonicalMovements?.[0]?.name || "Movement",
              trackingMethod: "completion",
              trackingConfig: {},
            },
          ];
      const nextTemplate = {
        ...template,
        name: isExisting ? `${template.name} Edited` : "New Session",
      };

      return ReactModule.createElement(
        "section",
        { "aria-label": "Mock Session Editor" },
        ReactModule.createElement("span", null, template?.name || "New Session Draft"),
        ReactModule.createElement(
          "button",
          {
            type: "button",
            disabled: saving,
            onClick: () => onSave?.({ template: nextTemplate, templateMovements: nextRows }),
          },
          "Save Mock Session"
        ),
        ReactModule.createElement(
          "button",
          { type: "button", onClick: onCancel },
          "Cancel Mock Session"
        )
      );
    },
  };
});

import SessionTemplateLibrary from "./SessionTemplateLibrary.jsx";

afterEach(cleanup);

function initialState() {
  return {
    programmes: [
      {
        id: "p1",
        family_id: "f1",
        name: "Football Skills",
        category: "Football",
        description: "Technical development",
        sort_order: 0,
        archived: false,
      },
      {
        id: "p2",
        family_id: "f1",
        name: "Empty Programme",
        category: "Other",
        description: "",
        sort_order: 1,
        archived: false,
      },
    ],
    movements: [
      { id: "m1", family_id: "f1", name: "Sole Rolls", description: "", archived: false },
      { id: "m2", family_id: "f1", name: "Unused Drill", description: "", archived: false },
    ],
    templates: [
      {
        id: "t1",
        family_id: "f1",
        programme_id: "p1",
        display_code: "A",
        name: "Close Control",
        description: "",
        planned_duration_sec: 900,
        version: 2,
        sort_order: 0,
        archived: false,
      },
    ],
    templateMovements: [
      {
        id: "tm1",
        family_id: "f1",
        session_template_id: "t1",
        movement_id: "m1",
        position: 1,
        display_label: "Sole Rolls",
        instructions: "",
        planned_duration_sec: 150,
        tracking_method: "repetitions",
        tracking_config: { countLabel: "Clean reps" },
      },
    ],
    developmentTags: [],
    movementDevelopmentTags: [],
  };
}

function makeDbApi(seed = initialState()) {
  const state = JSON.parse(JSON.stringify(seed));
  let programmeCounter = 10;
  let movementCounter = 10;
  let templateCounter = 10;
  let templateMovementCounter = 10;

  const activeSnapshot = () => ({
    programmes: state.programmes.filter((item) => !item.archived),
    movements: state.movements.filter((item) => !item.archived),
    templates: state.templates.filter((item) => !item.archived),
    templateMovements: state.templateMovements.slice(),
    developmentTags: [],
    movementDevelopmentTags: [],
  });

  const api = {
    state,
    loadSessionLibrary: vi.fn(async () => ({ data: activeSnapshot(), error: null })),
    createProgramme: vi.fn(async (familyId, payload) => {
      const row = {
        id: `p${programmeCounter++}`,
        family_id: familyId,
        name: payload.name,
        category: payload.category || "",
        description: payload.description || "",
        sort_order: payload.sortOrder || 0,
        archived: false,
      };
      state.programmes.push(row);
      return { data: row, error: null };
    }),
    updateProgramme: vi.fn(async (id, patch) => {
      const row = state.programmes.find((item) => item.id === id);
      Object.assign(row, {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.archived !== undefined ? { archived: patch.archived } : {}),
      });
      return { data: row, error: null };
    }),
    archiveProgramme: vi.fn(async (id, archived = true) => {
      const row = state.programmes.find((item) => item.id === id);
      row.archived = archived;
      return { data: row, error: null };
    }),
    createMovement: vi.fn(async (familyId, payload) => {
      const row = {
        id: `m${movementCounter++}`,
        family_id: familyId,
        name: payload.name,
        description: payload.description || "",
        archived: false,
      };
      state.movements.push(row);
      return { data: row, error: null };
    }),
    updateMovement: vi.fn(async (id, patch) => {
      const row = state.movements.find((item) => item.id === id);
      Object.assign(row, patch);
      return { data: row, error: null };
    }),
    archiveMovement: vi.fn(async (id, archived = true) => {
      const row = state.movements.find((item) => item.id === id);
      row.archived = archived;
      return { data: row, error: null };
    }),
    createSessionTemplate: vi.fn(async (familyId, payload) => {
      const row = {
        id: `t${templateCounter++}`,
        family_id: familyId,
        programme_id: payload.programmeId,
        display_code: payload.displayCode || "",
        name: payload.name,
        description: payload.description || "",
        planned_duration_sec: payload.plannedDurationSec ?? null,
        version: payload.version || 1,
        sort_order: payload.sortOrder || 0,
        archived: false,
      };
      state.templates.push(row);
      return { data: row, error: null };
    }),
    updateSessionTemplate: vi.fn(async (id, patch) => {
      const row = state.templates.find((item) => item.id === id);
      if (patch.programmeId !== undefined) row.programme_id = patch.programmeId;
      if (patch.displayCode !== undefined) row.display_code = patch.displayCode;
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.description !== undefined) row.description = patch.description;
      if (patch.plannedDurationSec !== undefined) row.planned_duration_sec = patch.plannedDurationSec;
      if (patch.version !== undefined) row.version = patch.version;
      if (patch.archived !== undefined) row.archived = patch.archived;
      return { data: row, error: null };
    }),
    archiveSessionTemplate: vi.fn(async (id, archived = true) => {
      const row = state.templates.find((item) => item.id === id);
      row.archived = archived;
      return { data: row, error: null };
    }),
    createSessionTemplateMovement: vi.fn(async (familyId, payload) => {
      const row = {
        id: `tm${templateMovementCounter++}`,
        family_id: familyId,
        session_template_id: payload.sessionTemplateId,
        movement_id: payload.movementId,
        position: payload.position,
        display_label: payload.displayLabel || "",
        instructions: payload.instructions || "",
        planned_duration_sec: payload.plannedDurationSec ?? null,
        tracking_method: payload.trackingMethod || "completion",
        tracking_config: payload.trackingConfig || {},
      };
      state.templateMovements.push(row);
      return { data: row, error: null };
    }),
    updateSessionTemplateMovement: vi.fn(async (id, patch) => {
      const row = state.templateMovements.find((item) => item.id === id);
      if (patch.sessionTemplateId !== undefined) row.session_template_id = patch.sessionTemplateId;
      if (patch.movementId !== undefined) row.movement_id = patch.movementId;
      if (patch.position !== undefined) row.position = patch.position;
      if (patch.displayLabel !== undefined) row.display_label = patch.displayLabel;
      if (patch.instructions !== undefined) row.instructions = patch.instructions;
      if (patch.plannedDurationSec !== undefined) row.planned_duration_sec = patch.plannedDurationSec;
      if (patch.trackingMethod !== undefined) row.tracking_method = patch.trackingMethod;
      if (patch.trackingConfig !== undefined) row.tracking_config = patch.trackingConfig;
      return { data: row, error: null };
    }),
    deleteSessionTemplateMovement: vi.fn(async (id) => {
      const index = state.templateMovements.findIndex((item) => item.id === id);
      if (index >= 0) state.templateMovements.splice(index, 1);
      return { error: null };
    }),
  };

  return api;
}

async function renderLibrary(dbApi = makeDbApi(), extraProps = {}) {
  render(
    <SessionTemplateLibrary
      familyId="f1"
      dbApi={dbApi}
      confirmArchive={() => true}
      {...extraProps}
    />
  );
  await waitFor(() => expect(dbApi.loadSessionLibrary).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText("Close Control")).toBeTruthy());
  return dbApi;
}

describe("SessionTemplateLibrary", () => {
  it("loads the Stage 2 definition library and lists Programmes and Sessions", async () => {
    const db = await renderLibrary();

    expect(db.loadSessionLibrary).toHaveBeenCalledWith("f1");
    expect(screen.getByText("Football Skills")).toBeTruthy();
    expect(screen.getByText("Empty Programme")).toBeTruthy();
    expect(screen.getByText("Close Control")).toBeTruthy();
    expect(screen.getByText("1 Session")).toBeTruthy();
  });

  it("opens a new Session inside the selected Programme and persists through the controller", async () => {
    const db = await renderLibrary();

    fireEvent.click(screen.getByRole("button", { name: "+ New Session" }));
    expect(screen.getByRole("region", { name: "Mock Session Editor" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save Mock Session" }));

    await waitFor(() => expect(db.createSessionTemplate).toHaveBeenCalled());
    expect(db.createSessionTemplate).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({ programmeId: "p1", name: "New Session", version: 1 })
    );
    expect(db.createSessionTemplateMovement).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({ movementId: "m2", position: 1 })
    );
  });

  it("loads an existing Session into the editor, saves it and bumps its version", async () => {
    const db = await renderLibrary();

    fireEvent.click(screen.getByRole("button", { name: "Edit Session Close Control" }));
    expect(screen.getByRole("region", { name: "Mock Session Editor" })).toBeTruthy();
    expect(screen.getByText("Close Control")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save Mock Session" }));

    await waitFor(() => expect(db.updateSessionTemplate).toHaveBeenCalled());
    expect(db.updateSessionTemplateMovement).toHaveBeenCalledWith("tm1", { position: 100001 });
    expect(db.updateSessionTemplate).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ name: "Close Control Edited", version: 3 })
    );
  });

  it("archives a Session only after confirmation and reloads the library", async () => {
    const db = makeDbApi();
    const confirmArchive = vi.fn(() => true);
    await renderLibrary(db, { confirmArchive });

    fireEvent.click(screen.getByRole("button", { name: "Archive Session Close Control" }));

    await waitFor(() => expect(db.archiveSessionTemplate).toHaveBeenCalledWith("t1", true));
    expect(confirmArchive).toHaveBeenCalledWith("Archive Session “Close Control”?");
    await waitFor(() => expect(screen.queryByText("Close Control")).toBeNull());
  });

  it("creates and edits canonical Movements through the Stage 2 DB API", async () => {
    const db = await renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Movements" }));

    fireEvent.click(screen.getByRole("button", { name: "+ New Movement" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Movement name" }), {
      target: { value: "Drag-Backs" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Movement description" }), {
      target: { value: "Pull and turn" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Movement" }));

    await waitFor(() => expect(db.createMovement).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({ name: "Drag-Backs", description: "Pull and turn" })
    ));

    await waitFor(() => expect(screen.getByText("Drag-Backs")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Edit Movement Drag-Backs" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Movement name" }), {
      target: { value: "Drag-Back Turn" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Movement" }));

    await waitFor(() => expect(db.updateMovement).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ name: "Drag-Back Turn" })
    ));
  });

  it("blocks archiving a Movement while an active Session references it", async () => {
    const db = makeDbApi();
    const confirmArchive = vi.fn(() => true);
    await renderLibrary(db, { confirmArchive });
    fireEvent.click(screen.getByRole("button", { name: "Movements" }));

    fireEvent.click(screen.getByRole("button", { name: "Archive Movement Sole Rolls" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Remove this Movement from 1 active Session before archiving it."
    );
    expect(confirmArchive).not.toHaveBeenCalled();
    expect(db.archiveMovement).not.toHaveBeenCalled();
  });

  it("archives an unused Movement and an empty Programme safely", async () => {
    const db = await renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Movements" }));
    fireEvent.click(screen.getByRole("button", { name: "Archive Movement Unused Drill" }));
    await waitFor(() => expect(db.archiveMovement).toHaveBeenCalledWith("m2", true));

    fireEvent.click(screen.getByRole("button", { name: "Sessions" }));
    fireEvent.click(screen.getByRole("button", { name: "Archive Programme Empty Programme" }));
    await waitFor(() => expect(db.archiveProgramme).toHaveBeenCalledWith("p2", true));
  });

  it("blocks archiving a Programme while it still owns active Sessions", async () => {
    const db = await renderLibrary();

    fireEvent.click(screen.getByRole("button", { name: "Archive Programme Football Skills" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Archive or move 1 active Session before archiving this Programme."
    );
    expect(db.archiveProgramme).not.toHaveBeenCalled();
  });

  it("surfaces library-load errors without writing anything", async () => {
    const db = makeDbApi();
    db.loadSessionLibrary.mockResolvedValueOnce({
      data: null,
      error: new Error("network down"),
    });

    render(
      <SessionTemplateLibrary familyId="f1" dbApi={db} confirmArchive={() => true} />
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load Session Library: network down"
    );
    expect(db.createSessionTemplate).not.toHaveBeenCalled();
  });
});
