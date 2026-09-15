// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConnectionsSettings from "./ConnectionsSettings.jsx";

function api(overrides = {}) {
  return {
    loadConnectionSettingsData: vi.fn(async () => ({ data: { connections: [], preferences: [] }, error: null })),
    startStravaConnection: vi.fn(async () => ({ data: { authorizeUrl: "https://strava.example/oauth" }, error: null })),
    disconnectStravaConnection: vi.fn(async () => ({ data: { status: "disconnected" }, error: null })),
    checkConnectedSources: vi.fn(async () => ({ data: { imported: 2 }, error: null })),
    purgeProviderData: vi.fn(async () => ({ data: { removedObservations: 4 }, error: null })),
    updateConnectionPreferences: vi.fn(async (profileId, provider, patch) => ({
      data: {
        preferences: {
          profile_id: profileId,
          provider,
          performance_metrics_enabled: true,
          heart_rate_enabled: false,
          include_private_activities: false,
          initial_import_days: 90,
          auto_log_window_days: 2,
          ...patch,
        },
      },
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

afterEach(() => cleanup());

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

  it("shows a clear OAuth return confirmation", async () => {
    const mockApi = api({
      loadConnectionSettingsData: vi.fn(async () => ({
        data: {
          connections: [{ profile_id: "paul", provider: "strava", status: "active", provider_account_label: "Paul Swain" }],
          preferences: [],
        },
        error: null,
      })),
    });
    render(
      <ConnectionsSettings
        profiles={profiles.slice(0, 1)}
        initialProfileId="paul"
        connectionReturn={{ provider: "strava", status: "connected", detail: "", profileId: "paul" }}
        api={mockApi}
      />
    );
    expect((await screen.findByRole("status")).textContent).toContain(
      "Strava connected successfully for Paul. Activity evidence is syncing now."
    );
    await screen.findByText("Paul Swain");
  });

  it("shows an OAuth failure without implying history changed", async () => {
    render(
      <ConnectionsSettings
        profiles={profiles.slice(0, 1)}
        initialProfileId="paul"
        connectionReturn={{ provider: "strava", status: "failed", detail: "token_exchange_failed", profileId: "paul" }}
        api={api()}
      />
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Strava connection failed. Workout Tracker history was not changed. Please try again."
    );
  });

  it("persists stream and history preferences through server authority", async () => {
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

    fireEvent.change(screen.getByLabelText(/History to import when connecting/i), { target: { value: "30" } });
    await waitFor(() => expect(mockApi.updateConnectionPreferences).toHaveBeenCalledWith("paul", "strava", { initial_import_days: 30 }));
  });

  it("keeps manual source check and destructive removal behind explicit connection controls", async () => {
    const mockApi = api({
      loadConnectionSettingsData: vi.fn(async () => ({
        data: {
          connections: [{ profile_id: "paul", provider: "strava", status: "active", provider_account_label: "Paul Swain", last_manual_sync_at: null }],
          preferences: [],
        },
        error: null,
      })),
    });
    render(
      <ConnectionsSettings
        profiles={profiles.slice(0, 1)}
        initialProfileId="paul"
        api={mockApi}
        authorizeMutation={async () => true}
        confirmAction={() => true}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "Check connected sources" }));
    await waitFor(() => expect(mockApi.checkConnectedSources).toHaveBeenCalledWith("paul", "strava"));

    fireEvent.click(screen.getByText("Connection options"));
    fireEvent.click(screen.getByRole("button", { name: "Disconnect & remove Strava data" }));
    await waitFor(() => expect(mockApi.purgeProviderData).toHaveBeenCalledWith("paul", "strava"));
  });
});
