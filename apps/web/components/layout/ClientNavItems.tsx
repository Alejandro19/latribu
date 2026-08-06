"use client";

import { CLIENT_NAV, MODULE_THEME, ARC_COLOR_VAR, type AppState } from "../../lib/constants";

type ClientNavItemsProps = {
  clientType: string | null;
  onboardingComplete: boolean;
  viewKey: string;
  onNavigate: (key: string) => void;
};

function navItemStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 14px",
    borderRadius: "12px",
    color: active ? "var(--terracota)" : "var(--ink-soft)",
    fontWeight: 600,
    fontSize: "14px",
    marginBottom: "4px",
    background: active ? "var(--terracota-soft)" : "none",
    border: "none",
    width: "100%",
    textAlign: "left" as const,
    cursor: "pointer",
    transition: "background 0.2s ease, color 0.2s ease",
  };
}

export default function ClientNavItems({
  clientType,
  onboardingComplete,
  viewKey,
  onNavigate,
}: ClientNavItemsProps) {
  const sn: AppState = {
    role: "cliente",
    clientType: clientType ?? null,
    onboardingComplete,
    planExpired: false,
  };

  return (
    <>
      {CLIENT_NAV.filter((item) => (item.visible ? item.visible(sn) : true)).map(
        (item) => {
          const cfg = MODULE_THEME[item.key];
          const dotColor = cfg
            ? `var(${ARC_COLOR_VAR[cfg.arc]})`
            : "var(--ink-soft)";
          const locked =
            item.key === "rest"
              ? clientType !== "mentoring"
              : clientType === "lead_wellness" &&
                (item.key === "training" || item.key === "nutrition");
          const active = viewKey === item.key;

          return (
            <button
              key={item.key}
              className="nav-item"
              onClick={() => onNavigate(item.key)}
              style={navItemStyle(active)}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "inline-block",
                  background: dotColor,
                  marginRight: 8,
                }}
              />
              {item.label}
              {locked && (
                <span style={{ fontSize: 12, marginLeft: 4 }}>🔒</span>
              )}
            </button>
          );
        }
      )}
    </>
  );
}
