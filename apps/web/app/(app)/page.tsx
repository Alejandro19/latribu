"use client";

import { useState } from "react";
import useSWR from "swr";
import { useAuth } from "@/lib/auth-context";
import { VIEW_TO_PATH } from "@/lib/constants";
import { getModuleAccessState } from "@/lib/module-access";
import { MemberCard } from "@/components/member/MemberCard";
import { CrownBadge } from "@/components/ui/CrownBadge";
import { ModuleExpiredModal } from "@/components/layout/ModuleExpiredModal";
import { PeriodConfirmationCard } from "@/components/checkins/PeriodConfirmationCard";
import { DailyRitualCard } from "@/components/rituals/DailyRitualCard";
import { WeeklyRitualCard } from "@/components/rituals/WeeklyRitualCard";
import { fetchClient } from "@/lib/clients-client";
import { getNutrition } from "@/lib/nutrition-client";
import { getWearableEstado } from "@/lib/wearable-client";
import { getProtocol } from "@/lib/sleep-client";
import { getEvolutionData } from "@/lib/evolution-client";
import { listEvents } from "@/lib/events-client";
import { listTherapies } from "@/lib/therapies-client";
import { listRetreats } from "@/lib/retreats-client";
import Link from "next/link";

const ALL_CLIENT_QUICK_LINKS = [
  { key: "training", label: "Workout", desc: "Tu plan de entrenamiento diario" },
  { key: "nutrition", label: "Nutrition", desc: "Plan alimenticio y comidas" },
  { key: "community", label: "The Circle", desc: "Eventos y terapias grupales" },
  { key: "rest", label: "Sleep", desc: "Tu recuperación nocturna, medida por tu wearable" },
  { key: "evolution", label: "Evolution", desc: "Tu proceso, en cifras" },
] as const;

type QuickLinkKey = (typeof ALL_CLIENT_QUICK_LINKS)[number]["key"];

// Nutrición, Descanso, Mi Evolución y Comunidad — chequeo "¿hay algo
// cargado?" reusando los mismos fetchers que ya usa cada panel, en vez de
// duplicar lógica de negocio acá. Comunidad es distinta a los otros:
// sus eventos/terapias/retiros son de toda la plataforma, no por cliente —
// "tiene datos" acá significa "hay al menos uno activo publicado ahora".
async function fetchQuickAccessSignals(clientId: string): Promise<Record<Exclude<QuickLinkKey, "training">, boolean>> {
  const [nutrition, wearables, protocol, evolution, events, therapies, retreats] = await Promise.all([
    getNutrition(clientId).catch(() => null),
    getWearableEstado(clientId).catch(() => []),
    getProtocol(clientId).catch(() => null),
    getEvolutionData(clientId).catch(() => null),
    listEvents().catch(() => []),
    listTherapies().catch(() => []),
    listRetreats().catch(() => []),
  ]);
  return {
    nutrition: Boolean(nutrition?.plan && "id" in nutrition.plan && nutrition.plan.id),
    rest: wearables.length > 0 || Boolean(protocol),
    evolution: Boolean(evolution) && (evolution!.checkins.length > 0 || evolution!.anthropometrics.length > 0 || evolution!.inbody.length > 0),
    community: events.length > 0 || therapies.length > 0 || retreats.length > 0,
  };
}

export default function InicioPage() {
  const { user, role, clientType, onboardingComplete, moduleAccess, planExpired } = useAuth();
  const [expiredModalOpen, setExpiredModalOpen] = useState(false);

  const isAdmin = role === "admin";
  // Solo la card de cada módulo que ya tenga datos cargados para este
  // cliente específico.
  const showQuickAccessGate = !isAdmin && clientType !== null;

  // Misma key que MemberCard.tsx — SWR la reusa sin pedirla dos veces.
  const { data: clientDetail } = useSWR(
    showQuickAccessGate && user?.id ? ["client-detail-for-member-card", user.id] : null,
    () => fetchClient(user!.id)
  );
  const { data: otherSignals } = useSWR(
    showQuickAccessGate && user?.id ? ["quick-access-signals", user.id] : null,
    () => fetchQuickAccessSignals(user!.id)
  );

  const signals: Record<QuickLinkKey, boolean> | null =
    showQuickAccessGate && otherSignals
      ? { training: Boolean(clientDetail?.trainingDays), ...otherSignals }
      : null;

  // Un módulo 'expired' fuerza su card a aparecer aunque no tenga datos —
  // si no, un cliente que nunca usó Nutrición no vería ningún aviso de que
  // la perdió al vencerse. 'not_included' nunca aparece (igual que hoy).
  const quickLinks = isAdmin
    ? [
        { key: "admin-clients", label: "Clientes", desc: "Gestionar clientes y permisos" },
        { key: "admin-quotes", label: "Frases", desc: "Administrar frases motivacionales" },
        { key: "community", label: "The Circle", desc: "Gestionar eventos y terapias" },
      ]
    : signals
      ? ALL_CLIENT_QUICK_LINKS.filter(
          (link) => signals[link.key] || getModuleAccessState(link.key, { moduleAccess, planExpired }) === "expired"
        )
      : [];

  return (
    <div className="fade-anim">
      {/* Welcome header */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontFamily: "var(--font-cormorant), Georgia, serif",
            fontSize: 32,
            fontWeight: 400,
            color: "var(--eph-text)",
            margin: "0 0 8px",
          }}
        >
          Bienvenido{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
        </h1>
        <p className="font-mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--eph-muted)", margin: 0 }}>
          {isAdmin
            ? "Panel de administración de Ephirox"
            : "Tu sistema de optimización ejecutiva."}
        </p>
      </div>

      {!isAdmin && user?.id && clientType === "mentoring" && (
        <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <DailyRitualCard clientId={user.id} />
          <WeeklyRitualCard clientId={user.id} />
        </div>
      )}
      {!isAdmin && user?.id && <MemberCard clientId={user.id} />}
      {!isAdmin && user?.id && clientType === "mentoring" && <PeriodConfirmationCard clientId={user.id} />}

      {/* Quick-access cards grid — Oura style: no shadow, subtle border, pill-radius */}
      {quickLinks.length > 0 && (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {quickLinks.map((link) => {
          const path = VIEW_TO_PATH[link.key] || `/${link.key}`;
          const state = isAdmin ? "ok" : getModuleAccessState(link.key, { moduleAccess, planExpired });
          const expired = state === "expired";
          return (
            <Link
              key={link.key}
              href={path}
              onClick={(e) => {
                if (expired) {
                  e.preventDefault();
                  setExpiredModalOpen(true);
                }
              }}
              style={{
                display: "block",
                position: "relative",
                background: "var(--eph-surface)",
                border: "1px solid var(--eph-line)",
                borderRadius: "0",
                padding: "20px 20px",
                textDecoration: "none",
                transition: "border-color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--eph-accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--eph-line)";
              }}
            >
              {expired && (
                <div style={{ position: "absolute", top: 14, right: 14 }}>
                  <CrownBadge circleSize={26} iconSize={15} />
                </div>
              )}
              <div
                className="font-display"
                style={{
                  fontSize: 17,
                  fontWeight: 400,
                  color: "var(--eph-text)",
                  marginBottom: 4,
                }}
              >
                {link.label}
              </div>
              <div className="font-body" style={{ fontSize: 12, color: "var(--eph-body)" }}>
                {expired ? "Renueva para continuar" : link.desc}
              </div>
            </Link>
          );
        })}
      </div>
      )}

      <ModuleExpiredModal open={expiredModalOpen} onClose={() => setExpiredModalOpen(false)} />
    </div>
  );
}
