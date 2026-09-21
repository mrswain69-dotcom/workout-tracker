// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FirstRunTutorial from "./FirstRunTutorial.jsx";

describe("FirstRunTutorial", () => {
  it("is immediately dismissible and reports the next destination", () => {
    const onExit = vi.fn();
    const onStepChange = vi.fn();
    render(<FirstRunTutorial step={0} onExit={onExit} onStepChange={onStepChange} />);

    expect(screen.getByText("Your week starts blank")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Exit tutorial" }));
    expect(onExit).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Show me the weekly plan" }));
    expect(onStepChange).toHaveBeenCalledWith(1, "plan");
  });

  it("supports back navigation and a separate finish action", () => {
    const onFinish = vi.fn();
    const onStepChange = vi.fn();
    const { rerender } = render(
      <FirstRunTutorial step={2} onStepChange={onStepChange} onFinish={onFinish} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onStepChange).toHaveBeenCalledWith(1, "plan");

    rerender(<FirstRunTutorial step={4} onStepChange={onStepChange} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole("button", { name: "Finish tutorial" }));
    expect(onFinish).toHaveBeenCalledOnce();
  });
});
