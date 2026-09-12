// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PerformanceAutobiography from "./PerformanceAutobiography.jsx";

function durationLog(date, profileId = "p1") {
  return {
    id: `log-${date}`,
    profile_id: profileId,
    date_ymd: date,
    log: {
      blocks: [
        {
          id: "planned",
          typeId: "duration",
          label: "Football training",
          loggedAt: `${date}T17:00:00.000Z`,
          duration: { minutes: 30 },
        },
      ],
    },
  };
}

const schedule = {
  Mon: [{ id: "planned", typeId: "duration" }],
  Tue: [],
  Wed: [{ id: "planned", typeId: "duration" }],
  Thu: [],
  Fri: [],
  Sat: [],
  Sun: [],
};

describe("PerformanceAutobiography Stage 5 UI", () => {
  it("keeps genuine date history visible while asking for a private DOB instead of guessing an age", () => {
    render(
      <PerformanceAutobiography
        profileId="p1"
        profileName="Wilf"
        logs={[durationLog("2026-01-05")]}
        timelineData={{
          profile: { id: "p1", birthDate: null },
          consistencySnapshots: [],
          groupAwards: [],
          knowledge: { sourceAvailable: false, milestones: [] },
          referenceDate: "2026-01-11",
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "Performance Autobiography" })).toBeInTheDocument();
    expect(screen.getByText("Unlock the true age timeline")).toBeInTheDocument();
    expect(screen.getByText(/Date-based history is already active/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Age 13/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Knowledge milestones: not available yet/i)).toBeInTheDocument();
  });

  it("renders true age chapters and supported Consistency milestones from supplied historical authority", () => {
    render(
      <PerformanceAutobiography
        profileId="p1"
        profileName="Wilf"
        logs={[durationLog("2026-01-05"), durationLog("2026-01-07")]}
        timelineData={{
          profile: { id: "p1", birthDate: "2012-06-15" },
          consistencySnapshots: [
            { profile_id: "p1", effective_date: "2026-01-05", schedule_json: schedule },
          ],
          groupAwards: [],
          knowledge: { sourceAvailable: false, milestones: [] },
          referenceDate: "2026-01-11",
        }}
        referenceDate="2026-01-11"
      />
    );

    const ageButton = screen.getByRole("button", { name: /Age 13/i });
    expect(ageButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Perfect consistency week")).toBeInTheDocument();
    expect(screen.getByText(/2 training days/i)).toBeInTheDocument();
    expect(screen.getByText(/Three years of real history unlocks the full career view/i)).toBeInTheDocument();
  });

  it("saves a private DOB and immediately unlocks the correct age chapter without mutating history", async () => {
    const dateApi = vi.fn(async () => ({
      data: { id: "p1", birth_date: "2012-06-15" },
      error: null,
    }));

    render(
      <PerformanceAutobiography
        profileId="p1"
        logs={[durationLog("2026-01-05")]}
        timelineData={{
          profile: { id: "p1", birthDate: null },
          consistencySnapshots: [],
          groupAwards: [],
          knowledge: { sourceAvailable: false, milestones: [] },
          referenceDate: "2026-01-11",
        }}
        dateApi={dateApi}
      />
    );

    fireEvent.change(screen.getByLabelText("Date of birth"), {
      target: { value: "2012-06-15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock ages" }));

    await waitFor(() => expect(dateApi).toHaveBeenCalledWith("p1", "2012-06-15"));
    expect(await screen.findByRole("button", { name: /Age 13/i })).toBeInTheDocument();
    expect(screen.getByText("Age timeline unlocked.")).toBeInTheDocument();
  });
});
