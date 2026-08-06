"use client";

export default function AdminHomePage() {
  return (
    <div>
      <h1
        style={{
          fontFamily: "Fraunces, Georgia, serif",
          fontSize: 28,
          fontWeight: 700,
          color: "var(--ink)",
          margin: "0 0 8px",
        }}
      >
        Hola, Admin
      </h1>
      <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0 }}>
        Elige un módulo en el menú para empezar.
      </p>
    </div>
  );
}