// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SessionPlanBlockEditor, {
  createSessionPlanBlock,
  formatSessionPlanDuration,
  getSessionPlanDefaultLabel,
  getSessionTemplateSnapshotName,
  normaliseSessionPlanBlock,
} from "./SessionPlanBlockEditor.jsx";

afterEach(cleanup);

const LIBRARY = {
  programmes: [
    { id: "p1", name: "Football Skills", sort_order: 0, archived: false },
    { id: "p2", name: "Other", sort_order: 1, archived: false },
  ],
  movements: [],
  templates: [
    {
      id: "t1",
      programme_id: "p1",
      display_code: "A",
      name: "Close Control",
      planned_duration_sec: 900,
      version: 3,
      sort_order: 0,
      archived: false,
    },
    {
      id: "t2",
      programme_id: "p1",
      display_code: "B",
      name: "First Touch & Protection",
      planned_duration_sec: 900,
      version: 1,
      sort_order: 1,
      archived: false,
    },
    {
      id: "t3",
      programme_id: "p2",
      display_code: "",
      name: "Archived Session",
      planned_duration_sec: 600,
      version: 1,
      sort_order: 0,
      archived: true,
    },
  ],
  templateMovements: [],
  developmentTags: [],
  movementDevelopmentTags: [],
};

function makeDbApi(result = { data: LIBRARY, error: null }) {
  return {
    loadSessionLibrary: vi.fn(async () => result),
  };
}

function renderEditor({ block = createSessionPlanBlock("b1"), onChange = vi.fn(), dbApi = makeDbApi(), ...props } = {}) {
  render(
    <SessionPlanBlockEditor
      familyId="f1"
      block={block}
      onChange={onChange}
      dbApi={dbApi}
      {...props}
    />
  );
  return { onChange, dbApi };
}

describe("Session plan block helpers", () => {
  it("creates the canonical additive Plan block contract", () => {
    expect(createSessionPlanBlock("abc")).toEqual({
      id: "abc",
      typeId: "session",
      label: "",
      note: "",
      sessionTemplateId: "",
      sessionTemplateNameSnapshot: "",
      plannedDurationSecOverride: null,
    });
  });

  it("normalises persisted camelCase and snake_case Session block fields", () => {
    expect(
      normaliseSessionPlanBlock({
        id: "b1",
        label: " Skills ",
        session_template_id: "t1",
        session_template_name_snapshot: "Session A — Close Control",
        planned_duration_sec_override: 840,
      })
    ).toEqual(
      expect.objectContaining({
        id: "b1",
        typeId: "session",
        label: "Skills",
        sessionTemplateId: "t1",
        sessionTemplateNameSnapshot: "Session A — Close Control",
        plannedDurationSecOverride: 840,
      })
    );
  });

  it("formats names and durations for Plan display", () => {
    const template = LIBRARY.templates[0];
    expect(getSessionTemplateSnapshotName(template)).toBe("Session A — Close Control");
    expect(getSessionPlanDefaultLabel(template, LIBRARY.programmes[0])).toBe(
      "Football Skills — Session A"
    );
    expect(formatSessionPlanDuration(900)).toBe("15 min");
    expect(formatSessionPlanDuration(150)).toBe("2:30");
  });
});

describe("SessionPlanBlockEditor", () => {
  it("loads the Session Library once for the family and hides archived templates", async () => {
    const { dbApi } = renderEditor();
    await waitFor(() => expect(dbApi.loadSessionLibrary).toHaveBeenCalledWith("f1"));

    const select = await screen.findByRole("combobox", { name: "Session template" });
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      "Choose a Session…",
      "Football Skills · Session A — Close Control · 15 min",
      "Football Skills · Session B — First Touch & Protection · 15 min",
    ]);
  });

  it("selects a template and emits only the lightweight Plan reference plus snapshots", async () => {
    const { onChange } = renderEditor();
    const select = await screen.findByRole("combobox", { name: "Session template" });
    await waitFor(() => expect(select.options.length).toBe(3));

    fireEvent.change(select, { target: { value: "t1" } });

    expect(onChange).toHaveBeenLastCalledWith({
      sessionTemplateId: "t1",
      sessionTemplateNameSnapshot: "Session A — Close Control",
      plannedDurationSecOverride: null,
      label: "Football Skills — Session A",
    });
  });

  it("does not overwrite a custom Plan block label when changing template", async () => {
    const onChange = vi.fn();
    renderEditor({
      block: {
        ...createSessionPlanBlock("b1"),
        label: "Tuesday ball work",
      },
      onChange,
    });
    const select = await screen.findByRole("combobox", { name: "Session template" });
    await waitFor(() => expect(select.options.length).toBe(3));
    fireEvent.change(select, { target: { value: "t2" } });

    expect(onChange).toHaveBeenLastCalledWith({
      sessionTemplateId: "t2",
      sessionTemplateNameSnapshot: "Session B — First Touch & Protection",
      plannedDurationSecOverride: null,
    });
  });

  it("shows the selected template summary and version", async () => {
    renderEditor({
      block: {
        ...createSessionPlanBlock("b1"),
        sessionTemplateId: "t1",
        sessionTemplateNameSnapshot: "Session A — Close Control",
      },
    });

    expect(await screen.findByText("Session A — Close Control")).toBeTruthy();
    expect(screen.getByText("Football Skills · 15 min · v3")).toBeTruthy();
    expect(screen.getByText("Planned duration: 15 min")).toBeTruthy();
  });

  it("stores an optional duration override in canonical seconds", async () => {
    const onChange = vi.fn();
    renderEditor({
      block: {
        ...createSessionPlanBlock("b1"),
        sessionTemplateId: "t1",
        sessionTemplateNameSnapshot: "Session A — Close Control",
      },
      onChange,
    });

    const input = await screen.findByRole("spinbutton", {
      name: "Session duration override minutes",
    });
    fireEvent.change(input, { target: { value: "12.5" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenLastCalledWith({ plannedDurationSecOverride: 750 });
  });

  it("clears a duration override by leaving the field blank", async () => {
    const onChange = vi.fn();
    renderEditor({
      block: {
        ...createSessionPlanBlock("b1"),
        sessionTemplateId: "t1",
        sessionTemplateNameSnapshot: "Session A — Close Control",
        plannedDurationSecOverride: 600,
      },
      onChange,
    });

    const input = await screen.findByRole("spinbutton", {
      name: "Session duration override minutes",
    });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenLastCalledWith({ plannedDurationSecOverride: null });
  });

  it("preserves the saved name snapshot when the referenced template is unavailable", async () => {
    renderEditor({
      block: {
        ...createSessionPlanBlock("b1"),
        sessionTemplateId: "old-template",
        sessionTemplateNameSnapshot: "Session Z — Historic Skills",
      },
    });

    expect(
      await screen.findByText(
        "Saved template: Session Z — Historic Skills. It is currently unavailable or archived."
      )
    ).toBeTruthy();
  });

  it("surfaces Session Library load errors without emitting Plan changes", async () => {
    const onChange = vi.fn();
    const dbApi = makeDbApi({ data: null, error: new Error("network down") });
    renderEditor({ onChange, dbApi });

    expect((await screen.findByRole("alert")).textContent).toContain("network down");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables all Plan Session controls when the parent editor is disabled", async () => {
    renderEditor({
      block: {
        ...createSessionPlanBlock("b1"),
        sessionTemplateId: "t1",
        sessionTemplateNameSnapshot: "Session A — Close Control",
      },
      disabled: true,
    });

    const select = await screen.findByRole("combobox", { name: "Session template" });
    const input = await screen.findByRole("spinbutton", {
      name: "Session duration override minutes",
    });
    expect(select.disabled).toBe(true);
    expect(input.disabled).toBe(true);
  });
});
