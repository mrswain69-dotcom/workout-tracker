import React, { useEffect, useId, useRef, useState } from "react";
import "./InfoHint.css";

export default function InfoHint({ label, children }) {
  const id = useId();
  const root = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || focused || pinned;

  useEffect(() => {
    if (!pinned) return;
    const dismiss = (event) => {
      if (!root.current?.contains(event.target)) {
        setPinned(false);
        setFocused(false);
        setHovered(false);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [pinned]);

  return (
    <span className="infoHint" ref={root}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button type="button" className="infoHint__button" aria-label={`About ${label}`}
        aria-expanded={open} aria-controls={id} aria-describedby={open ? id : undefined}
        onFocus={(event) => setFocused(event.currentTarget.matches(":focus-visible"))}
        onBlur={() => { setFocused(false); setPinned(false); }}
        onClick={() => { setPinned((value) => !value); setHovered(false); setFocused(false); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setPinned(false); setHovered(false); setFocused(false);
            event.stopPropagation();
          }
        }}>
        <span aria-hidden="true">i</span>
      </button>
      <span id={id} role="tooltip" className="infoHint__content" hidden={!open}>{children}</span>
    </span>
  );
}
