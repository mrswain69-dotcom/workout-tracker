// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import InfoHint from "./InfoHint.jsx";

afterEach(cleanup);

describe("optional explanations", () => {
  it("starts hidden and toggles with taps, including after a pointer hover", () => {
    render(<InfoHint label="XP">Experience points</InfoHint>);
    const button = screen.getByRole("button", { name: "About XP" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    fireEvent.mouseEnter(button.parentElement);
    fireEvent.click(button);
    fireEvent.mouseLeave(button.parentElement);
    expect(screen.getByRole("tooltip").textContent).toBe("Experience points");
    fireEvent.click(button);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("opens on hover and dismisses when the pointer leaves", () => {
    render(<InfoHint label="Streak">Completed plan days</InfoHint>);
    const button = screen.getByRole("button");
    fireEvent.mouseEnter(button.parentElement);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    fireEvent.mouseLeave(button.parentElement);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
  it("opens on keyboard focus and closes on Escape", () => {
    render(<InfoHint label="XP">Experience points</InfoHint>);
    const button = screen.getByRole("button");
    button.focus();
    fireEvent.focus(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(button, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
  it("dismisses a pinned explanation when tapping outside", () => {
    render(<InfoHint label="XP">Experience points</InfoHint>);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    fireEvent.pointerDown(document.body);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});
