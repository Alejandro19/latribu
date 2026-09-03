"use client";

import { useAuth } from "@/lib/auth-context";
import PanelConfiguracion from "@/components/account/PanelConfiguracion";

export default function ConfiguracionPage() {
  // AppShell ya bloquea el render hasta que useAuth() termina de cargar
  // (ver components/layout/AppShell.tsx) — mismo patrón que el resto de las
  // páginas de cliente.
  const { user } = useAuth();
  const clientId = user?.id ?? null;

  return <div>{clientId && <PanelConfiguracion clientId={clientId} />}</div>;
}
