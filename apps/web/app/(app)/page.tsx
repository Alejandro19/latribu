"use client";

import { useAuth } from "@/lib/auth-context";
import { VIEW_TO_PATH } from "@/lib/constants";
import Link from "next/link";

export default function InicioPage() {
  const { user, role, clientType, onboardingComplete } = useAuth();

  const isAdmin = role === "admin";

  // Quick-access cards for the user
  const quickLinks = isAdmin
    ? [
        { key: "admin-clients", label: "Clientes", desc: "Gestionar clientes y permisos" },
        { key: "admin-quotes", label: "Frases", desc: "Administrar frases motivacionales" },
        { key: "community", label: "Comunidad", desc: "Gestionar eventos y terapias" },
      ]
    : [
        { key: "training", label: "Entrenamiento", desc: "Tu plan de entrenamiento diario" },
        { key: "nutrition", label: "Nutrición", desc: "Plan alimenticio y comidas" },
        { key: "community", label: "Comunidad", desc: "Eventos y terapias grupales" },
      ];

  return (
    <div className="fade-anim">
      {/* Welcome header */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontFamily: "Fraunces, Georgia, serif",
            fontSize: 28,
            fontWeight: 700,
            color: "var(--ink)",
            margin: "0 0 6px",
          }}
        >
          ¡Hola{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0 }}>
          {isAdmin
            ? "Panel de administración de La Tribu"
            : "Tu espacio de bienestar y alto rendimiento"}
        </p>
      </div>

      {/* Quick-access cards grid — Oura style: no shadow, subtle border, pill-radius */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {quickLinks.map((link) => {
          const path = VIEW_TO_PATH[link.key] || `/${link.key}`;
          return (
            <Link
              key={link.key}
              href={path}
              style={{
                display: "block",
                background: "var(--paper)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "20px 20px",
                textDecoration: "none",
                transition: "border-color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--gold)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--line)";
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--ink)",
                  marginBottom: 4,
                }}
              >
                {link.label}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                {link.desc}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
