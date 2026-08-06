"use client";

import { useAuth } from "../../lib/auth-context";

export default function UserChip() {
  const { user, role, logout } = useAuth();

  const initial = (user?.name ?? "U").charAt(0).toUpperCase();
  const isAdmin = role === "admin";
  const roleLabel = isAdmin ? "Admin" : "Miembro";

  return (
    <div
      style={{
        marginTop: "auto",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* User info chip — Oura-style: clean row, subtle border */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px",
          borderRadius: "var(--radius)",
          border: "1px solid var(--line)",
          background: "var(--cream)",
        }}
      >
        {/* Avatar circle */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: isAdmin ? "var(--terracota-soft)" : "var(--sage-soft)",
            color: isAdmin ? "var(--terracota)" : "var(--sage)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initial}
        </div>

        {/* Name + role */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user?.name ?? "Usuario"}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--ink-soft)",
              marginTop: 1,
            }}
          >
            {roleLabel}
          </div>
        </div>
      </div>

      {/* Logout — secondary pill button */}
      <button
        onClick={logout}
        style={{
          width: "100%",
          background: "none",
          border: "1px solid var(--line)",
          borderRadius: "9999px",
          padding: "8px 16px",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--ink-soft)",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--cream)";
          e.currentTarget.style.color = "var(--ink)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "none";
          e.currentTarget.style.color = "var(--ink-soft)";
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
