"use client";

export default function AdminHomePage() {
  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--font-cormorant), Georgia, serif",
          fontSize: 30,
          fontWeight: 400,
          color: "var(--eph-text)",
          margin: "0 0 8px",
        }}
      >
        Bienvenido, Admin
      </h1>
      <p style={{ fontSize: 14, color: "var(--eph-body)", margin: 0 }}>
        Elige un módulo en el menú para empezar.
      </p>
    </div>
  );
}