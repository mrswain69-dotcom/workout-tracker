import React from "react";

const STEPS = [
  {
    kicker: "WELCOME",
    title: "Your week starts blank",
    body: "Nothing has been chosen for you. Build a week that matches your training, sport and recovery needs.",
    action: "Show me the weekly plan",
    tab: "plan",
  },
  {
    kicker: "STEP 1 OF 4",
    title: "Choose a day",
    body: "In Plan, select a weekday and add the activity blocks that belong on that day. Empty days are genuine rest days.",
    action: "Next",
    tab: "plan",
  },
  {
    kicker: "STEP 2 OF 4",
    title: "Build the activity",
    body: "Add strength, cardio, duration, recovery, session or task blocks. You can edit the name, targets and coaching notes.",
    action: "Next",
    tab: "plan",
  },
  {
    kicker: "STEP 3 OF 4",
    title: "Repeat what works",
    body: "Use Copy to place a block on other days instead of rebuilding it. Presets are optional and never applied automatically.",
    action: "Show me Today",
    tab: "dashboard",
  },
  {
    kicker: "STEP 4 OF 4",
    title: "Follow the plan — or add an extra",
    body: "Today shows what is planned. A blank day will not increase or break your streak, and you can still log an extra activity whenever you choose.",
    action: "Finish tutorial",
    tab: "dashboard",
  },
];

export const FIRST_RUN_TUTORIAL_VERSION = 1;

export default function FirstRunTutorial({ step = 0, onStepChange, onExit, onFinish }) {
  const safeStep = Math.max(0, Math.min(STEPS.length - 1, Number(step) || 0));
  const item = STEPS[safeStep];
  const isLast = safeStep === STEPS.length - 1;

  const goTo = (nextStep) => {
    const bounded = Math.max(0, Math.min(STEPS.length - 1, nextStep));
    onStepChange?.(bounded, STEPS[bounded].tab);
  };

  return (
    <div className="firstRunTutorial" role="dialog" aria-modal="true" aria-labelledby="first-run-title">
      <div className="firstRunTutorial__card">
        <div className="firstRunTutorial__top">
          <div className="firstRunTutorial__kicker">{item.kicker}</div>
          <button type="button" className="firstRunTutorial__exit" onClick={onExit} aria-label="Exit tutorial">
            Exit tutorial
          </button>
        </div>

        <div className="firstRunTutorial__progress" aria-label={`Tutorial step ${safeStep + 1} of ${STEPS.length}`}>
          {STEPS.map((_, index) => (
            <span key={index} className={index <= safeStep ? "active" : ""} />
          ))}
        </div>

        <h2 id="first-run-title">{item.title}</h2>
        <p>{item.body}</p>

        <div className="firstRunTutorial__actions">
          {safeStep > 0 ? (
            <button type="button" className="btn btn-secondary" onClick={() => goTo(safeStep - 1)}>
              Back
            </button>
          ) : <span />}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => isLast ? onFinish?.() : goTo(safeStep + 1)}
          >
            {item.action}
          </button>
        </div>
      </div>
    </div>
  );
}
