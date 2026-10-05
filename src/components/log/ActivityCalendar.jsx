import React, { useEffect, useMemo, useRef, useState } from "react";
import { shiftActivityCalendarDate } from "../../engine/activityCalendarEngine.js";
import "./ActivityCalendar.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function validYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function parts(value) {
  if (!validYmd(value)) return { year: 0, month: 0, day: 0 };
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function monthStart(value) {
  const { year, month } = parts(value);
  return year && month ? `${year}-${String(month).padStart(2, "0")}-01` : "";
}

function moveMonth(value, amount) {
  const { year, month } = parts(value);
  if (!year || !month) return value;
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return date.toISOString().slice(0, 10);
}

function displayDate(value) {
  const { year, month, day } = parts(value);
  return year ? `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}` : "Choose date";
}

function monthLabel(value) {
  const { year, month } = parts(value);
  if (!year) return "";
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

function buildGrid(value) {
  const start = monthStart(value);
  if (!start) return [];
  const first = new Date(`${start}T00:00:00.000Z`);
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const gridStart = shiftActivityCalendarDate(start, -mondayOffset);
  return Array.from({ length: 42 }, (_, index) => shiftActivityCalendarDate(gridStart, index));
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 2.5v3M15 2.5v3M3.5 7.5h13M4 4.5h12a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export default function ActivityCalendar({
  value,
  todayYmd,
  onChange,
  getDayState,
}) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(value || todayYmd));
  const rootRef = useRef(null);

  useEffect(() => {
    setVisibleMonth(monthStart(value || todayYmd));
  }, [todayYmd, value]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const days = useMemo(() => buildGrid(visibleMonth), [visibleMonth]);
  const selectedMonth = visibleMonth.slice(0, 7);

  return (
    <div className="activityCalendar" ref={rootRef}>
      <button
        type="button"
        className="activityCalendar__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{displayDate(value)}</span>
        <CalendarIcon />
      </button>

      {open ? (
        <div className="activityCalendar__popover" role="dialog" aria-label="Choose workout date">
          <div className="activityCalendar__head">
            <button type="button" aria-label="Previous month" onClick={() => setVisibleMonth((current) => moveMonth(current, -1))}>‹</button>
            <strong>{monthLabel(visibleMonth)}</strong>
            <button type="button" aria-label="Next month" onClick={() => setVisibleMonth((current) => moveMonth(current, 1))}>›</button>
          </div>
          <div className="activityCalendar__weekdays" aria-hidden="true">
            {WEEKDAYS.map((day) => <span key={day}>{day.slice(0, 2)}</span>)}
          </div>
          <div className="activityCalendar__grid">
            {days.map((dateYmd) => {
              const state = getDayState?.(dateYmd) || { kind: "none", label: "" };
              const day = Number(dateYmd.slice(-2));
              const outside = dateYmd.slice(0, 7) !== selectedMonth;
              return (
                <button
                  type="button"
                  key={dateYmd}
                  className={`activityCalendar__day is-${state.kind || "none"}${dateYmd === value ? " is-selected" : ""}${dateYmd === todayYmd ? " is-today" : ""}${outside ? " is-outside" : ""}`}
                  aria-label={`${dateYmd}. ${state.label || "No completed activity"}`}
                  title={state.label || "No completed activity"}
                  onClick={() => {
                    onChange?.(dateYmd);
                    setOpen(false);
                  }}
                >
                  <span>{day}</span>
                  {state.icon ? <small aria-hidden="true">{state.icon}</small> : null}
                </button>
              );
            })}
          </div>
          <div className="activityCalendar__legend" aria-label="Calendar colour key">
            <span className="is-complete">Complete</span>
            <span className="is-rest">Rest</span>
            <span className="is-illness">Illness</span>
            <span className="is-cancelled">Cancelled</span>
            <span className="is-streak-saver">Streak saver</span>
          </div>
          <button
            type="button"
            className="activityCalendar__today"
            onClick={() => {
              onChange?.(todayYmd);
              setOpen(false);
            }}
          >
            Today
          </button>
        </div>
      ) : null}
    </div>
  );
}
