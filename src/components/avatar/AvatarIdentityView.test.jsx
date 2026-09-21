// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AvatarIdentityView from "./AvatarIdentityView";

const identity = {
  label: "Sky Collie",
  subtitle: "Air Search",
  collection: "Rescue Legends",
  imgSrc: "/avatars/pack13/sky-collie.png",
  story: "A complete test story for the avatar.",
  traits: ["Service", "Teamwork", "Calm"],
  unlockSource: { label: "16,000 XP milestone" },
};

afterEach(cleanup);

describe("AvatarIdentityView", () => {
  it("shows personal selection statistics and closes with Escape", () => {
    const onClose = vi.fn();
    render(
      <AvatarIdentityView
        identity={identity}
        athleteName="Alex"
        stats={{ xpEarned: 120, workoutsCompleted: 3, selectionCount: 1 }}
        trackedSince="2026-09-21T00:00:00.000Z"
        isSelected
        onSelect={() => {}}
        onClose={onClose}
      />
    );
    expect(screen.getByRole("dialog", { name: "Sky Collie" })).toBeTruthy();
    expect(screen.getByText("120")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Currently active" }).disabled).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("lets an unlocked avatar be applied from its identity card", () => {
    const onSelect = vi.fn();
    render(
      <AvatarIdentityView
        identity={identity}
        athleteName="Alex"
        stats={{ selectionCount: 0 }}
        onSelect={onSelect}
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Use this avatar" }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("keeps the Group version limited to shared context", () => {
    render(
      <AvatarIdentityView
        mode="group"
        identity={identity}
        athleteName="Taylor"
        stats={{ weeksWon: 2, sharedChallengesCompleted: 1, awards: [] }}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("Shared-group weeks won")).toBeTruthy();
    expect(screen.queryByText("XP while selected")).toBeNull();
    expect(screen.queryByText("Time selected")).toBeNull();
    expect(screen.getByText(/workout history.*stay private/i)).toBeTruthy();
  });
});
