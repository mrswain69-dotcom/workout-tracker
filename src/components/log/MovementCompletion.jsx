import React, { useEffect, useRef, useState } from "react";

export default function MovementCompletion({ complete, signature, onDone, autoDisabled = false, onDisableAuto }) {
  const previous = useRef(signature);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const [edited, setEdited] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (previous.current !== signature) {
      previous.current = signature;
      setEdited(true);
    }
  }, [signature]);

  useEffect(() => {
    setReady(false);
    if (!complete || !edited) return;
    let finish;
    const idle = setTimeout(() => {
      setReady(true);
      if (!autoDisabled) finish = setTimeout(() => doneRef.current(), 3000);
    }, 2000);
    return () => { clearTimeout(idle); clearTimeout(finish); };
  }, [complete, signature, edited, autoDisabled]);

  if ((!ready && !autoDisabled) || !complete) return null;
  return (
    <div className="movementCompletion" aria-label="Movement completion">
      <button type="button" className={`movementCompletionDone ${autoDisabled ? "" : "isCounting"}`}
        onClick={() => doneRef.current()}><span>Done</span></button>
      {!autoDisabled && <button type="button" className="movementCompletionCancel"
        aria-label="Keep movement open and disable automatic collapse" title="Keep open"
        onClick={onDisableAuto}>×</button>}
      {autoDisabled && <span className="muted mini" role="status">Auto-collapse off</span>}
    </div>
  );
}
