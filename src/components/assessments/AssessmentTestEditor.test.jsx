// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssessmentTestEditor from "./AssessmentTestEditor.jsx";

afterEach(cleanup);

function renderEditor(overrides = {}) {
  const onSave = vi.fn();
  const props = {
    value: {
      id: "t1",
      name: "10 m acceleration",
      description: "Sprint test",
      version: 2,
      metric_type: "time",
      unit: "s",
      scoring_direction: "lower",
      attempt_count: 3,
      result_strategy: "best",
      side_mode: "none",
      allow_negative: false,
      pb_eligible: true,
      metric_config: { decimalPlaces: 2, percentageDecimalPlaces: 1 },
    },
    developmentTags: [
      { id: "tag-speed", name: "Speed" },
      { id: "tag-football", name: "Football" },
      { id: "tag-old", name: "Old", archived: true },
    ],
    selectedDevelopmentTagIds: ["tag-speed"],
    onSave,
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<AssessmentTestEditor {...props} />);
  return { ...props, onSave };
}

describe("AssessmentTestEditor", () => {
  it("renders an existing Test using the normalized metric contract", () => {
    renderEditor();
    expect(screen.getByLabelText("Test name").value).toBe("10 m acceleration");
    expect(screen.getByLabelText("Metric type").value).toBe("time");
    expect(screen.getByLabelText("Scoring direction").value).toBe("lower");
    expect(screen.getByLabelText("Attempt count").value).toBe("3");
    expect(screen.getByLabelText("Result strategy").value).toBe("best");
    expect(screen.getByText("v2")).toBeTruthy();
  });

  it("shows active Development Tags and preserves selected relationships", () => {
    renderEditor();
    expect(screen.getByLabelText("Speed").checked).toBe(true);
    expect(screen.getByLabelText("Football").checked).toBe(false);
    expect(screen.queryByLabelText("Old")).toBeNull();
  });

  it("submits edited Test data plus exact selected tag IDs", () => {
    const { onSave } = renderEditor();
    fireEvent.change(screen.getByLabelText("Test name"), { target: { value: "10m Sprint" } });
    fireEvent.click(screen.getByLabelText("Football"));
    fireEvent.click(screen.getByText("Save Test"));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        test: expect.objectContaining({
          id: "t1",
          name: "10m Sprint",
          metricType: "time",
          scoringDirection: "lower",
          attemptCount: 3,
        }),
        developmentTagIds: expect.arrayContaining(["tag-speed", "tag-football"]),
      })
    );
  });

  it("prevents saving when Test name is blank", () => {
    const { onSave } = renderEditor();
    fireEvent.change(screen.getByLabelText("Test name"), { target: { value: "   " } });
    expect(screen.getByText("Save Test").disabled).toBe(true);
    fireEvent.click(screen.getByText("Save Test"));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("forces attempts/successes away from the unsupported average strategy", () => {
    renderEditor({
      value: {
        name: "Receiving",
        metricType: "numeric",
        resultStrategy: "average",
      },
    });
    fireEvent.change(screen.getByLabelText("Metric type"), {
      target: { value: "attempts_successes" },
    });
    expect(screen.getByLabelText("Result strategy").value).toBe("single");
    expect(screen.getByRole("option", { name: "Average" }).disabled).toBe(true);
  });

  it("supports separate left/right and signed values", () => {
    const { onSave } = renderEditor();
    fireEvent.change(screen.getByLabelText("Side mode"), { target: { value: "separate" } });
    fireEvent.click(screen.getByLabelText("Allow negative values"));
    fireEvent.click(screen.getByText("Save Test"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        test: expect.objectContaining({ sideMode: "separate", allowNegative: true }),
      })
    );
  });

  it("exposes advanced percentage-safety and precision controls", () => {
    const { onSave } = renderEditor();
    fireEvent.click(screen.getByText("Metric details"));
    fireEvent.change(screen.getByLabelText("Decimal places"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Percentage improvement mode"), { target: { value: "never" } });
    fireEvent.click(screen.getByText("Save Test"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        test: expect.objectContaining({
          metricConfig: expect.objectContaining({ decimalPlaces: 3, percentageImprovement: "never" }),
        }),
      })
    );
  });

  it("shows attempts/successes comparison controls only for that metric", () => {
    renderEditor({ value: { name: "First touch", metricType: "attempts_successes" } });
    fireEvent.click(screen.getByText("Metric details"));
    expect(screen.getByLabelText("Attempts successes comparison mode")).toBeTruthy();
    expect(screen.getByLabelText("Show success rate beside result")).toBeTruthy();
  });
});
