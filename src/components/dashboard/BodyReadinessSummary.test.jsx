// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BodyReadinessSummary from "./BodyReadinessSummary.jsx";

afterEach(cleanup);

describe("Body readiness guidance", () => {
  it("shows a useful starting action instead of a score without recent activity", () => {
    const onOpenLog = vi.fn();
    render(<BodyReadinessSummary readiness={{ hasRecentActivity: false, trainingReadinessScore: 100, band: { label: "Prime" } }} onOpenLog={onOpenLog} />);
    expect(screen.getByText("Awaiting activity")).toBeTruthy();
    expect(screen.queryByText("Prime")).toBeNull();
    expect(screen.queryByText("100")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open today’s log" }));
    expect(onOpenLog).toHaveBeenCalledOnce();
  });

  it("offers expandable estimation details and retains valid zero values", () => {
    render(<BodyReadinessSummary readiness={{ hasRecentActivity: true, trainingReadinessScore: 64, muscleReadiness: 0, nervousSystemReadiness: 55, bodyEnergy: 70, projectedTrainingReadinessScore: 80 }} />);
    const toggle = screen.getByText("How is this estimated?");
    expect(toggle.closest("details").open).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.closest("details").open).toBe(true);
    expect(screen.getByText("0/100")).toBeTruthy();
    expect(screen.getByText("80/100")).toBeTruthy();
  });

  it("does not render a missing score as zero", () => {
    const { container } = render(<BodyReadinessSummary readiness={{ trainingReadinessScore: null }} />);
    expect(container.querySelector(".dashboardReadiness__score").textContent.trim()).toBe("—");
  });
});
