"use client";

import { useAuth } from "../../lib/auth-context";

export default function PlanExpiredScreen() {
  const { planEndDate } = useAuth();

  const endDateStr = planEndDate
    ? new Date(planEndDate + "T00:00:00").toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "var(--cream)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Oura-style card: clean, no shadow, subtle border, pill-radius */}
      <div
        style={{
          maxWidth: 440,
          width: "100%",
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: "20px",
          padding: "40px 32px",
          textAlign: "center",
        }}
      >
        {/* Lock icon — Oura-style visual anchor */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--terracota-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: 24,
          }}
        >
          🔒
        </div>

        <h2
          style={{
            fontFamily: "Fraunces, Georgia, serif",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--ink)",
            margin: "0 0 12px",
          }}
        >
          Tu plan ha vencido
        </h2>

        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {endDateStr
            ? `Tu membresía venció el ${endDateStr}. `
            : ""}
          Contacta a tu coach para renovar tu plan y recuperar el acceso a la
          plataforma.
        </p>
      </div>
    </div>
  );
}
