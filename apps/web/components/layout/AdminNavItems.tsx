"use client";

import { useState } from "react";
import { ADMIN_NAV, ADMIN_HUB_SUBITEMS } from "../../lib/constants";

type AdminNavItemsProps = {
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

export default function AdminNavItems({
  viewKey,
  onNavigate,
}: AdminNavItemsProps) {
  // "Administración" expand state is local to this component
  const [adminHubOpen, setAdminHubOpen] = useState(false);

  return (
    <>
      {ADMIN_NAV.map((item) => {
        if (item.key === "admin-hub") {
          const expanded = adminHubOpen;
          return (
            <div key={item.key}>
              <button
                className="nav-item"
                onClick={() => setAdminHubOpen((v) => !v)}
                style={navItemStyle(expanded)}
              >
                {item.label}
              </button>
              {expanded &&
                ADMIN_HUB_SUBITEMS.map((sub) => (
                  <button
                    key={sub.key}
                    className="nav-item"
                    onClick={() => onNavigate(sub.key)}
                    style={{
                      ...navItemStyle(viewKey === sub.key),
                      paddingLeft: 32,
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    {sub.label}
                  </button>
                ))}
            </div>
          );
        }
        return (
          <button
            key={item.key}
            className="nav-item"
            onClick={() => onNavigate(item.key)}
            style={navItemStyle(viewKey === item.key)}
          >
            {item.label}
          </button>
        );
      })}
    </>
  );
}
