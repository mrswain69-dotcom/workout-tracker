import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConnectionsSettings from "./ConnectionsSettings.jsx";

function api(overrides = {}) {
  return {
    loadConnectionSettingsData: vi.fn(async () => ({ data: { connections: [], preferences: [] }, error: null })),
    startStravaConnection: vi.fn(async () => ({ data: { authorizeUrl: "https://strava.example/oauth" }, error: null })),
    disconnectStravaConnection: vi.fn(async () => ({ data: { status: "disconnected" }, error: null })),
    updateConnectionPreferences: vi.fn(async (profileId, provider, patch) => ({
      data: { preferences: { profile_id: profileId, provider, performance_metrics_enabled: true, heart_rate_enabled: false, include_private_activities: false, ...patch } },
      error: null,
    })),
    ...overrides,
  };
}

const profiles = [
  { id: "paul", name: "Paul", archived: false },
  { id: "wilf", name: "Wilf", archived: false },
  { id: "xander", name: "Xander", archived: false },
];

describe("ConnectionsSettings", () => {
  it("assigns OAuth to the explicitly selected athlete rather than an implicit active profile", async () => {
    const mockApi = api();
    const navigate = vi.fn();
    render(
      <ConnectionsSettings
        profiles={profiles}
        initialProfileId="paul"
        api={mockApi}
        authorizeMutation={async () => true}
        confirmAction={() => true}
        navigateToProvider={navigate}
      />
    );

    await screen.findByText("Connect Strava to Paul");
    fireEvent.change(screen.getByLabelText("Athlete for connected apps"), { target: { value: "wilf" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect Strava to Wilf" }));

    await waitFor(() => expect(mockApi.startStravaConnection).toHaveBeenCalledWith("wilf", { includePrivate: false }));
    expect(navigate).toHaveBeenCalledWith("https://strava.example/oauth");
  });

  it("persists stream preferences through server authority", async () => {
    const mockApi = api();
    render(
      <ConnectionsSettings
        profiles={profiles.slice(0, 1)}
        initialProfileId="paul"
        api={mockApi}
        authorizeMutation={async () => true}
        confirmAction={() => true}
      />
    );
    await screen.findByText("Connect Strava to Paul");
    fireEvent.click(screen.getByRole("checkbox", { name: /Heart-rate data/i }));
    await waitFor(() => expect(mockApi.updateConnectionPreferences).toHaveBeenCalledWith("paul", "strava", { heart_rate_enabled: true }));
  });
});
