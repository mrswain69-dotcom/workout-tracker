import React from "react";

export default function BadgeTierLabel({ tier, className = "" }) {
  const name = String(tier || "").toLowerCase();
  return <span className={`badgeTierLabel badgeTierLabel--${name || "locked"} ${className}`}>{name ? name.charAt(0).toUpperCase() + name.slice(1) : "Not started"}</span>;
}
