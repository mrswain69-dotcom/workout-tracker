// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CommunityDiscovery from "./CommunityDiscovery.jsx";
afterEach(cleanup);
const programmes = [{ id: "a", title: "Youth speed", creator_name: "Coach", credentials_verified: true, purpose: "Speed", sport: "Football", equipment: ["Cones"], week_count: 4, age_band: "youth" }, { id: "b", title: "Adult strength", purpose: "Strength", week_count: 8, age_band: "adults", equipment: ["Weights"] }];
const context = { programmes: [], bookmarks: [{ program_id: "a", title: "Youth speed", available: true }, { program_id: "hidden", title: "Past plan", available: false }], reviewer: false };
const props = { programmes, context, profileId: "wilf", authorize: async () => true, onOpen: vi.fn(), onCreator: vi.fn(), onRefresh: vi.fn() };
describe("Community browsing", () => {
  it("shows saved programmes and explains unavailable bookmarks", () => {
    render(<CommunityDiscovery {...props} />);
    fireEvent.click(screen.getByText("Saved programmes (2)"));
    expect(screen.getByText("Youth speed")).toBeTruthy();
    expect(screen.queryByText("Adult strength")).toBeNull();
    expect(screen.getByText("Past plan")).toBeTruthy();
    expect(screen.getByText(/no longer available in Community/)).toBeTruthy();
  });
  it("combines controls and clears filters while preserving Saved mode", () => {
    render(<CommunityDiscovery {...props} />);
    fireEvent.click(screen.getByText("More filters"));
    fireEvent.change(screen.getByLabelText("Duration"), { target: { value: "long" } });
    expect(screen.queryByText("Youth speed")).toBeNull(); expect(screen.getByText("Adult strength")).toBeTruthy();
    fireEvent.click(screen.getByText("Saved programmes (2)"));
    fireEvent.click(screen.getByText("Clear filters"));
    expect(screen.getByText("Youth speed")).toBeTruthy(); expect(screen.queryByText("Adult strength")).toBeNull();
  });
  it("keeps moderation controls hidden from ordinary members", () => {
    render(<CommunityDiscovery {...props} />);
    expect(screen.queryByText("Review Community reports")).toBeNull();
  });
});
