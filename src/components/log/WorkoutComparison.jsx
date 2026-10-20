import React from "react";
import "./WorkoutComparison.css";
export default function WorkoutComparison({ previous, target }) {
  return <section className="workoutComparison" aria-label="Workout comparison">
    <div><span>Last time{previous?.date ? ` · ${new Date(`${previous.date}T12:00:00Z`).toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"})}` : ""}</span><strong>{previous?.text || "Your first recorded session"}</strong></div>
    <div><span>Today’s plan / target</span><strong>{target || "Record what you do today"}</strong></div>
  </section>;
}
