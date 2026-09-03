"use client";

import { useAuth } from "@/lib/auth-context";
import PanelMembresias from "@/components/account/PanelMembresias";

export default function MembresiasPage() {
  // Ruta alcanzable incluso con planExpired=true (ver AppShell.tsx) — es la
  // única puerta de salida del bloqueo total para un cliente vencido.
  const { user } = useAuth();
  const clientId = user?.id ?? null;

  return <div>{clientId && <PanelMembresias clientId={clientId} />}</div>;
}
