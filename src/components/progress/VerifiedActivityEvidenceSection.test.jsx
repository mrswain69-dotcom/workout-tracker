// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VerifiedActivityEvidenceSection from "./VerifiedActivityEvidenceSection.jsx";

describe("VerifiedActivityEvidenceSection", () => {
  it("is read-only evidence and points connection management to Settings", async () => {
    const api = {
      loadVerifiedActivityData: vi.fn(async () => ({
        data: {
          connections: [{ provider: "strava", status: "active" }],
          observations: [],
          verifiedActivities: [],
          observationLinks: [],
          manualLinks: [],
        },
        error: null,
      })),
    };
    render(<VerifiedActivityEvidenceSection profileId="paul" profileName="Paul" api={api} />);
    await screen.findByText("Connect a source in Settings → Connections.");
    expect(screen.queryByRole("button", { name: /Connect Strava/i })).toBeNull();

    const connectedSources = screen.getByText("Connected sources").closest("div");
    expect(connectedSources?.textContent).toContain("1");
  });
});
