import { describe, expect, it } from "vitest";
import {
  SESSION_COMPLETION_XP,
  getSessionBlockLoadScore,
  getSessionBlockTrainingMinutes,
  getSessionBlockXp,
  isStructuredSessionBlock,
  sessionBlockHasActivity,
  sessionBlockIsComplete,
} from "./sessionCore.js";

function sessionBlock(overrides = {}) {
  const sessionOverrides = overrides.session || {};
  const blockOverrides = { ...overrides };
  delete blockOverrides.session;

  return {
    id: "session-block-1",
    typeId: "session",
    cancelled: false,
    session: {
      schemaVersion: 1,
      templateId: "session-a",
      templateVersion: 1,
      displayCode: "A",
      name: "Close Control",
      plannedDurationSec: 900,
      actualDurationSec: null,
      completed: false,
      movements: [
        {
          templateMovementId: "a-1",
          movementId: "sole-rolls",
          completed: false,
          skipped: false,
          trackingMethod: "repetitions",
          trackingConfig: {},
          result: null,
          note: "",
        },
      ],
      ...sessionOverrides,
    },
    ...blockOverrides,
  };
}

describe("structured Session core semantics", () => {
  it("gives a completed 15-minute Session fixed completion XP and training load", () => {
    const block = sessionBlock({
      session: {
        completed: true,
        movements: [
          {
            templateMovementId: "a-1",
            movementId: "sole-rolls",
            completed: true,
            skipped: false,
            trackingMethod: "repetitions",
            trackingConfig: {},
            result: null,
            note: "",
          },
        ],
      },
    });

    expect(isStructuredSessionBlock(block)).toBe(true);
    expect(sessionBlockHasActivity(block)).toBe(true);
    expect(sessionBlockIsComplete(block)).toBe(true);
    expect(getSessionBlockTrainingMinutes(block)).toBe(15);
    expect(getSessionBlockLoadScore(block)).toBe(15);
    expect(getSessionBlockXp(block)).toBe(SESSION_COMPLETION_XP);
    expect(SESSION_COMPLETION_XP).toBe(10);
  });

  it("uses actual elapsed duration ahead of planned duration", () => {
    const block = sessionBlock({
      session: {
        completed: true,
        actualDurationSec: 780,
      },
    });

    expect(getSessionBlockTrainingMinutes(block)).toBe(13);
    expect(getSessionBlockLoadScore(block)).toBe(13);
  });

  it("treats partial movement results as activity but not completion or XP", () => {
    const block = sessionBlock({
      session: {
        movements: [
          {
            templateMovementId: "a-1",
            movementId: "sole-rolls",
            completed: false,
            skipped: false,
            trackingMethod: "repetitions",
            trackingConfig: {},
            result: { overall: { count: 36 } },
            note: "",
          },
        ],
      },
    });

    expect(sessionBlockHasActivity(block)).toBe(true);
    expect(sessionBlockIsComplete(block)).toBe(false);
    expect(getSessionBlockTrainingMinutes(block)).toBe(0);
    expect(getSessionBlockLoadScore(block)).toBe(0);
    expect(getSessionBlockXp(block)).toBe(0);
  });

  it("can retain real partial elapsed time as workload without awarding XP", () => {
    const block = sessionBlock({
      session: {
        actualDurationSec: 300,
        movements: [
          {
            templateMovementId: "a-1",
            movementId: "sole-rolls",
            completed: true,
            skipped: false,
            trackingMethod: "repetitions",
            trackingConfig: {},
            result: null,
            note: "",
          },
        ],
      },
    });

    expect(sessionBlockHasActivity(block)).toBe(true);
    expect(sessionBlockIsComplete(block)).toBe(false);
    expect(getSessionBlockTrainingMinutes(block)).toBe(5);
    expect(getSessionBlockLoadScore(block)).toBe(5);
    expect(getSessionBlockXp(block)).toBe(0);
  });

  it("makes a cancelled Session invisible to completion, load and XP", () => {
    const block = sessionBlock({
      cancelled: true,
      session: {
        completed: true,
        actualDurationSec: 900,
        movements: [
          {
            templateMovementId: "a-1",
            movementId: "sole-rolls",
            completed: true,
            skipped: false,
            trackingMethod: "repetitions",
            trackingConfig: {},
            result: { overall: { count: 100 } },
            note: "",
          },
        ],
      },
    });

    expect(sessionBlockHasActivity(block)).toBe(false);
    expect(sessionBlockIsComplete(block)).toBe(false);
    expect(getSessionBlockTrainingMinutes(block)).toBe(0);
    expect(getSessionBlockLoadScore(block)).toBe(0);
    expect(getSessionBlockXp(block)).toBe(0);
  });

  it("does not increase XP when detailed movement counts increase", () => {
    const lowCount = sessionBlock({
      session: {
        completed: true,
        movements: [
          {
            templateMovementId: "a-1",
            movementId: "sole-rolls",
            completed: true,
            skipped: false,
            trackingMethod: "repetitions",
            trackingConfig: {},
            result: { overall: { count: 1 } },
            note: "",
          },
        ],
      },
    });
    const hugeCount = sessionBlock({
      session: {
        completed: true,
        movements: [
          {
            templateMovementId: "a-1",
            movementId: "sole-rolls",
            completed: true,
            skipped: false,
            trackingMethod: "repetitions",
            trackingConfig: {},
            result: { overall: { count: 999999 } },
            note: "",
          },
        ],
      },
    });

    expect(getSessionBlockXp(lowCount)).toBe(10);
    expect(getSessionBlockXp(hugeCount)).toBe(10);
  });

  it("ignores unrelated block types", () => {
    const block = { typeId: "strength", cancelled: false };

    expect(isStructuredSessionBlock(block)).toBe(false);
    expect(sessionBlockHasActivity(block)).toBe(false);
    expect(sessionBlockIsComplete(block)).toBe(false);
    expect(getSessionBlockTrainingMinutes(block)).toBe(0);
    expect(getSessionBlockLoadScore(block)).toBe(0);
    expect(getSessionBlockXp(block)).toBe(0);
  });
});
