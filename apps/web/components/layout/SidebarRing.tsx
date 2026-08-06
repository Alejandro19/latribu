"use client";

import { type ArcType, MODULE_THEME, ARC_COLOR_VAR } from "../../lib/constants";

type SidebarRingProps = {
  viewKey: string;
};

export default function SidebarRing({ viewKey }: SidebarRingProps) {
  const cfg = MODULE_THEME[viewKey];
  const activeArc: ArcType = cfg?.arc ?? "balanced";
  const ringLabel = cfg?.ringLabel ?? "La Tribu";

  const arcStates = {
    morning: activeArc === "morning" ? "active" : activeArc === "balanced" ? "balanced" : "",
    afternoon: activeArc === "afternoon" ? "active" : activeArc === "balanced" ? "balanced" : "",
    evening: activeArc === "evening" ? "active" : activeArc === "balanced" ? "balanced" : "",
  };

  const arcOpacity = (state: string) => {
    if (state === "active") return 1;
    if (state === "balanced") return 0.5;
    return 0.25;
  };

  return (
    <div className="sidebar-ring-wrap" style={{ textAlign: "center", margin: "4px 0 22px" }}>
      <svg viewBox="0 0 100 100" width="80" height="80" style={{ transform: "rotate(-90deg)" }}>
        {/* morning arc (top-right) */}
        <circle
          cx="50" cy="50" r="40"
          fill="none"
          stroke={`var(${ARC_COLOR_VAR["morning"]})`}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray="76 176" strokeDashoffset="0"
          opacity={arcOpacity(arcStates.morning)}
        />
        {/* afternoon arc (bottom-right) */}
        <circle
          cx="50" cy="50" r="40"
          fill="none"
          stroke={`var(${ARC_COLOR_VAR["afternoon"]})`}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray="76 176" strokeDashoffset="-83.8"
          opacity={arcOpacity(arcStates.afternoon)}
        />
        {/* evening arc (bottom-left) */}
        <circle
          cx="50" cy="50" r="40"
          fill="none"
          stroke={`var(${ARC_COLOR_VAR["evening"]})`}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray="76 176" strokeDashoffset="-167.6"
          opacity={arcOpacity(arcStates.evening)}
        />
      </svg>
      <div
        className="sidebar-ring-label"
        style={{
          fontSize: "10.5px",
          color: "var(--ink-soft)",
          textAlign: "center",
          marginTop: "8px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {ringLabel}
      </div>
    </div>
  );
}