"use client";

import { useRouter } from "next/navigation";
import { CrownBadge } from "../ui/CrownBadge";
import Button from "../ui/Button";

export function ModuleExpiredModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2500,
        background: "rgba(0,0,0,.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 380, width: "100%", background: "var(--eph-surface)",
          border: "1px solid var(--eph-line)", borderRadius: 0,
          padding: "32px 28px", textAlign: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <CrownBadge circleSize={44} iconSize={22} />
        </div>
        <p className="font-body" style={{ fontSize: 14, color: "var(--eph-text)", lineHeight: 1.6, margin: "0 0 24px" }}>
          Este módulo está incluido en tu membresía. Renueva tu pago para volver a acceder.
        </p>
        <Button
          type="button"
          variant="primary"
          onClick={() => router.push("/configuracion/membresias")}
          className="w-full mb-2"
        >
          Renovar membresía
        </Button>
        <Button type="button" variant="tertiary" onClick={onClose} className="w-full justify-center">
          Cerrar
        </Button>
      </div>
    </div>
  );
}
