// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SessionTemplateEditor, {
  normaliseSessionTemplateDraft,
  validateSessionTemplateDraft,
} from "./SessionTemplateEditor.jsx";

afterEach(cleanup);

const programmes = [
  { id: "p1", name: "Football Skills", sort_order: 0, archived: false },
  { id: "p2", name: "Explosive Speed", sort_order: 1, archived: false },
];

const movements = [
  { id: "m1", name: "Sole Rolls", archived: false },
  { id: "m2", name: "Drag-Backs", archived: false },
  { id: "m3", name: "Scissor + Cut", archived: false },
];

function baseTemplate(overrides = {}) {
  return {
    id: "t1",
    programme_id: "p1",
    display_code: "A",
    name: "Close Control",
    description: "Technical ball mastery.",
    planned_duration_sec: 300,
    version: 2,
    ...overrides,
  };
}

function baseRows() {
  return [
    {
      id: "tm1",
      movement_id: "m1",
      position: 1,
      display_label: "Sole Rolls",
      instructions: "Fast feet.",
      planned_duration_sec: 150,
      tracking_method: "repetitions",
      tracking_config: { countLabel: "Clean reps" },
    },
    {
      id: "tm2",
      movement_id: "m2",
      position: 2,
      display_label: "Drag-Backs",
      instructions: "Stay low.",
      planned_duration_sec: 150,
      tracking_method: "repetitions",
      tracking_config: { countLabel: "Clean reps" },
    },
  ];
}

describe("SessionTemplateEditor helpers", () => {
  it("normalises snake_case database fields into the editor contract", () => {
    expect(normaliseSessionTemplateDraft(baseTemplate())).toEqual(
      expect.objectContaining({
        id: "t1",
        programmeId: "p1",
        displayCode: "A",
        name: "Close Control",
        plannedDurationSec: 300,
        version: 2,
      })
    );
  });

  it("validates required programme, name, movement count and movement selection", () => {
    const invalid = validateSessionTemplateDraft(
      { programmeId: "", name: "" },
      [{ movementId: "", position: 1 }]
    );
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toContain("Choose a programme.");
    expect(invalid.errors).toContain("Session name is required.");
    expect(invalid.errors).toContain("Movement 1 must select a library movement.");

    const valid = validateSessionTemplateDraft(
      { programmeId: "p1", name: "Session A" },
      [{ movementId: "m1", position: 1 }]
    );
    expect(valid.valid).toBe(true);
  });
});

describe("SessionTemplateEditor", () => {
  it("renders template identity, version and mm:ss duration", () => {
    render(
      <SessionTemplateEditor
        template={baseTemplate()}
        templateMovements={baseRows()}
        programmes={programmes}
        canonicalMovements={movements}
      />
    );

    expect(screen.getByRole("textbox", { name: "Session code" }).value).toBe("A");
    expect(screen.getByRole("textbox", { name: "Session name" }).value).toBe("Close Control");
    expect(screen.getByRole("textbox", { name: "Session planned duration" }).value).toBe("5:00");
    expect(screen.getByText("Version 2")).toBeTruthy();
    expect(screen.getByText("Movement total: 5:00")).toBeTruthy();
  });

  it("emits clean template changes without writing anything itself", () => {
    const onChange = vi.fn();
    render(
      <SessionTemplateEditor
        template={baseTemplate()}
        templateMovements={baseRows()}
        programmes={programmes}
        canonicalMovements={movements}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Session name" }), {
      target: { value: "Close Control Plus" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Session description" }), {
      target: { value: "Updated technical session." },
    });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        template: expect.objectContaining({
          name: "Close Control Plus",
          description: "Updated technical session.",
        }),
      }),
      expect.objectContaining({ source: "template", field: "description" })
    );
  });

  it("adds a blank movement row that must select a canonical movement", () => {
    const onChange = vi.fn();
    render(
      <SessionTemplateEditor
        template={baseTemplate()}
        templateMovements={baseRows()}
        programmes={programmes}
        canonicalMovements={movements}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "+ Add movement" }));

    expect(screen.getByRole("region", { name: "Movement 3" })).toBeTruthy();
    expect(screen.getByText("Movement 3 must select a library movement.")).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        templateMovements: expect.arrayContaining([
          expect.objectContaining({ position: 3, movementId: "" }),
        ]),
      }),
      expect.objectContaining({ source: "movement-add" })
    );
  });

  it("reorders movements and rewrites sequential positions", () => {
    const onChange = vi.fn();
    render(
      <SessionTemplateEditor
        template={baseTemplate()}
        templateMovements={baseRows()}
        programmes={programmes}
        canonicalMovements={movements}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Move movement 1 down" }));

    const payload = onChange.mock.calls.at(-1)[0];
    expect(payload.templateMovements.map((row) => row.movementId)).toEqual(["m2", "m1"]);
    expect(payload.templateMovements.map((row) => row.position)).toEqual([1, 2]);
  });

  it("removes a movement and keeps remaining positions sequential", () => {
    const onChange = vi.fn();
    render(
      <SessionTemplateEditor
        template={baseTemplate()}
        templateMovements={baseRows()}
        programmes={programmes}
        canonicalMovements={movements}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove movement 1" }));

    const payload = onChange.mock.calls.at(-1)[0];
    expect(payload.templateMovements).toHaveLength(1);
    expect(payload.templateMovements[0]).toEqual(
      expect.objectContaining({ movementId: "m2", position: 1 })
    );
  });

  it("can set the Session duration from the sum of movement durations", () => {
    const onChange = vi.fn();
    render(
      <SessionTemplateEditor
        template={baseTemplate({ planned_duration_sec: 900 })}
        templateMovements={baseRows()}
        programmes={programmes}
        canonicalMovements={movements}
        onChange={onChange}
      />
    );

    expect(screen.getByText("Movement total: 5:00")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use movement total" }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        template: expect.objectContaining({ plannedDurationSec: 300 }),
      }),
      expect.objectContaining({ field: "plannedDurationSec", source: "movement-total" })
    );
    expect(screen.getByRole("textbox", { name: "Session planned duration" }).value).toBe("5:00");
  });

  it("allows the same canonical movement to appear more than once", () => {
    const onSave = vi.fn();
    const duplicateRows = [
      ...baseRows().slice(0, 1),
      {
        id: "tm2",
        movement_id: "m1",
        position: 2,
        display_label: "Sole Rolls — weak foot",
        planned_duration_sec: 150,
        tracking_method: "repetitions",
        tracking_config: { sideMode: "separate" },
      },
    ];

    render(
      <SessionTemplateEditor
        template={baseTemplate()}
        templateMovements={duplicateRows}
        programmes={programmes}
        canonicalMovements={movements}
        onSave={onSave}
      />
    );

    const save = screen.getByRole("button", { name: "Save Session" });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        templateMovements: [
          expect.objectContaining({ movementId: "m1", position: 1 }),
          expect.objectContaining({ movementId: "m1", position: 2 }),
        ],
      })
    );
  });

  it("blocks Save until the definition is valid", () => {
    render(
      <SessionTemplateEditor
        template={{ programmeId: "", name: "" }}
        templateMovements={[]}
        programmes={programmes}
        canonicalMovements={movements}
        onSave={() => {}}
      />
    );

    const save = screen.getByRole("button", { name: "Save Session" });
    expect(save.disabled).toBe(true);
    expect(screen.getByText("Choose a programme.")).toBeTruthy();
    expect(screen.getByText("Session name is required.")).toBeTruthy();
    expect(screen.getByText("Add at least one movement.")).toBeTruthy();
  });

  it("saves the canonical template and movement payload without incrementing version in the UI", () => {
    const onSave = vi.fn();
    render(
      <SessionTemplateEditor
        template={baseTemplate()}
        templateMovements={baseRows()}
        programmes={programmes}
        canonicalMovements={movements}
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Save Session" }));

    expect(onSave).toHaveBeenCalledWith({
      template: expect.objectContaining({
        id: "t1",
        programmeId: "p1",
        displayCode: "A",
        name: "Close Control",
        plannedDurationSec: 300,
        version: 2,
      }),
      templateMovements: [
        expect.objectContaining({
          id: "tm1",
          movementId: "m1",
          position: 1,
          plannedDurationSec: 150,
          trackingMethod: "repetitions",
        }),
        expect.objectContaining({
          id: "tm2",
          movementId: "m2",
          position: 2,
          plannedDurationSec: 150,
          trackingMethod: "repetitions",
        }),
      ],
    });
  });

  it("passes movement-editor changes through the template payload", () => {
    const onChange = vi.fn();
    render(
      <SessionTemplateEditor
        template={baseTemplate()}
        templateMovements={baseRows()}
        programmes={programmes}
        canonicalMovements={movements}
        onChange={onChange}
      />
    );

    const firstMovement = screen.getByRole("region", { name: "Movement 1" });
    fireEvent.change(
      within(firstMovement).getByRole("combobox", { name: "Movement 1 tracking method" }),
      { target: { value: "attempts_successes" } }
    );

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        templateMovements: expect.arrayContaining([
          expect.objectContaining({
            position: 1,
            trackingMethod: "attempts_successes",
            trackingConfig: expect.objectContaining({ required: false }),
          }),
        ]),
      }),
      expect.objectContaining({ source: "movement", movementIndex: 0 })
    );
  });
});
