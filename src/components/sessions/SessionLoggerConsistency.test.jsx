// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  completeSessionForLogging,
  reopenSessionForLogging,
} from "./SessionLogger.jsx";

describe("SessionLogger consistency timestamps", () => {
  it("records the explicit first completion time without changing result payloads", () => {
    const session = {
      completed: false,
      movements: [
        { movementId: "m1", completed: false, skipped: false, result: { count: 12 } },
      ],
    };
    const completed = completeSessionForLogging(session, "2026-09-10T17:15:00.000Z");
    expect(completed.completed).toBe(true);
    expect(completed.completedAt).toBe("2026-09-10T17:15:00.000Z");
    expect(completed.movements[0]).toMatchObject({ completed: true, result: { count: 12 } });
  });

  it("clears the completion timestamp when reopened so a later re-completion gets a new truth timestamp", () => {
    const reopened = reopenSessionForLogging({
      completed: true,
      completedAt: "2026-09-10T17:15:00.000Z",
      movements: [{ movementId: "m1", completed: true }],
    });
    expect(reopened.completed).toBe(false);
    expect(reopened.completedAt).toBe("");

    const reCompleted = completeSessionForLogging(reopened, "2026-09-11T08:00:00.000Z");
    expect(reCompleted.completedAt).toBe("2026-09-11T08:00:00.000Z");
  });
});
