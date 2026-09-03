"use client";

import { useRouter } from "next/navigation";
import { IconAlertTriangleFilled } from "../ui/icons";

// Acceso no restrictivo (estilo Oura): informa sin bloquear. Persistente en
// todas las pantallas del cliente mientras su plan esté vencido — ver
// AppShell.tsx, que ya no reemplaza la pantalla por un takeover total.
//
// Franja translúcida superpuesta sobre el borde inferior del topbar (marginTop
// negativo + zIndex por encima de ClientTopbar, que usa zIndex:80) — el
// topbar y el banner nunca scrollean (solo <main> tiene overflow propio en
// AppShell.tsx), así que no hace falta position:sticky para mantener la
// superposición. backdrop-filter no tiene fallback explícito porque no hace
// falta: sin soporte, el navegador simplemente ignora el blur y el fondo
// rgba semitransparente solo ya queda legible por su cuenta.
export function MembershipExpiredBanner() {
  const router = useRouter();
  return (
    <div
      className="font-body"
      style={{
        position: "relative",
        zIndex: 81,
        marginTop: -8,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "10px 16px",
        background: "rgba(201,164,106,0.16)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        borderTop: "1px solid rgba(201,164,106,0.35)",
        fontSize: 13, fontWeight: 500,
      }}
    >
      <IconAlertTriangleFilled size={15} style={{ color: "var(--eph-accent)" }} />
      <span style={{ color: "var(--eph-text)" }}>Tu membresía está inactiva</span>
      <button
        type="button"
        onClick={() => router.push("/configuracion/membresias")}
        style={{
          background: "none", border: "none", padding: 0,
          color: "var(--eph-accent)", fontWeight: 500, textDecoration: "underline",
          cursor: "pointer", fontSize: 13,
        }}
      >
        Renovar
      </button>
    </div>
  );
}
