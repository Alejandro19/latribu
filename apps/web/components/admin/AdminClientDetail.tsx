"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { getCheckinsStatus } from "../../lib/checkins-client";
import {
  fetchClient,
  activateClient,
  deactivateClient,
  saveClientType,
  resolveDeletionRequest,
  fetchMembershipPayments,
  approveMembershipPayment,
  resendInvitation,
  approveBaseline,
  approveWearable,
  type ClientDetail,
  type MembershipPayment,
} from "../../lib/clients-client";
import {
  getPersonalInfo,
  type PersonalInfo,
} from "../../lib/personal-info-client";
import { putPersonalInfo } from "../../lib/onboarding-client";
import { listLabPanels, type LabPanel } from "../../lib/lab-panels-client";
import { MENTORING_CARGO_TYPES, MENTORING_SECTORS } from "@latribu/shared-types";
import { showToast } from "../layout/AppShell";
import { OnboardingSummaryAccordion } from "./OnboardingSummaryAccordion";
import { AdminLabPanelReview } from "./AdminLabPanelReview";

const cardStyle: React.CSSProperties = {
  background: "var(--eph-surface)", border: "1px solid var(--eph-line)",
  borderRadius: "0", padding: "22px 24px", marginBottom: 20,
};

const cardTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 18, fontWeight: 400, color: "var(--eph-text)",
  margin: "0 0 16px",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace", fontSize: 10,
  textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 400,
  color: "var(--eph-muted)", marginBottom: 6,
};

const pillButtonStyle: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
  fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
  borderRadius: 0, padding: "7px 16px",
};

const inputStyle: React.CSSProperties = {
  width: "100%", height: 36, borderRadius: 0,
  border: "none", borderBottom: "1px solid var(--eph-line-2)", padding: "0 2px 6px", fontSize: 14.5,
  fontWeight: 600, background: "transparent", color: "var(--eph-text)", outline: "none",
  boxSizing: "border-box",
};

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(cents / 100);
}

function formatDateEs(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

const PAYMENT_STATUS_LABELS: Record<string, string> = { pending: "Pendiente", succeeded: "Aprobado", failed: "Rechazado" };

// Concatena paquete + plazo en un solo campo legible, ej. "12 clases / 3
// meses" (Cliente 1:1) o "3 meses" (Mentoría, sin paquete).
function formatPlanDetail(payment: { packageSize: number | null; durationMonths: number }): string {
  const duration = `${payment.durationMonths} ${payment.durationMonths === 1 ? "mes" : "meses"}`;
  return payment.packageSize != null ? `${payment.packageSize} clases / ${duration}` : duration;
}

// "Para que el mentor lo mencione en sesión" (spec Fase C) — nunca un
// mecanismo de recordatorio, solo un dato para la conversación 1:1.
function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function CheckinsComplianceCard({ clientId }: { clientId: string }) {
  const { data } = useSWR(["checkins-status", clientId], () => getCheckinsStatus(clientId));
  return (
    <div style={cardStyle}>
      <h3 style={cardTitleStyle}>Cumplimiento de check-ins</h3>
      <p style={{ fontSize: 14, color: "var(--eph-text)", margin: 0 }}>
        {!data
          ? "Cargando…"
          : data.lastResponseAt
            ? `Última respuesta: hace ${daysSince(data.lastResponseAt)} día${daysSince(data.lastResponseAt) === 1 ? "" : "s"}.`
            : "Nunca ha respondido un check-in."}
      </p>
    </div>
  );
}

export default function AdminClientDetail({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo | null>(null);
  const [payments, setPayments] = useState<MembershipPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState("");
  const [acting, setActing] = useState(false);
  const [cargoType, setCargoType] = useState("");
  const [sector, setSector] = useState("");
  const [savingSegmentation, setSavingSegmentation] = useState(false);
  const [resendingInvitation, setResendingInvitation] = useState(false);
  const [labPanels, setLabPanels] = useState<LabPanel[]>([]);
  const [approvingBaseline, setApprovingBaseline] = useState(false);
  const [approvingWearable, setApprovingWearable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [c, info, pays, panels] = await Promise.all([
        fetchClient(clientId),
        getPersonalInfo(clientId).catch(() => null),
        fetchMembershipPayments(clientId).catch(() => []),
        listLabPanels(clientId).catch(() => []),
      ]);
      setClient(c);
      setPersonalInfo(info);
      setPayments(pays);
      setLabPanels(panels);
      setSelectedType(c.client_type || c.clientType || "");
      setCargoType(info?.cargoType || "");
      setSector(info?.sector || "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar.");
    } finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const handleActivate = async () => {
    if (!selectedType) { showToast("Elige el tipo de cliente antes de activar.", "error"); return; }
    setActing(true);
    try { setClient(await activateClient(clientId, selectedType)); showToast("Cliente activado.", "success"); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error.", "error"); }
    finally { setActing(false); }
  };

  const handleDeactivate = async () => {
    setActing(true);
    try { setClient(await deactivateClient(clientId)); showToast("Cliente desactivado.", "success"); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error.", "error"); }
    finally { setActing(false); }
  };

  const handleSaveType = async () => {
    setActing(true);
    try { setClient(await saveClientType(clientId, selectedType)); showToast("Tipo guardado.", "success"); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error.", "error"); }
    finally { setActing(false); }
  };

  const handleSaveSegmentation = async () => {
    setSavingSegmentation(true);
    try {
      await putPersonalInfo(clientId, {
        cargo_type: cargoType || undefined,
        sector: sector || undefined,
      });
      showToast("Segmentación guardada.", "success");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error.", "error");
    } finally { setSavingSegmentation(false); }
  };

  const handleResolveDeletionRequest = async () => {
    setActing(true);
    try { setClient(await resolveDeletionRequest(clientId)); showToast("Solicitud marcada como resuelta.", "success"); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error.", "error"); }
    finally { setActing(false); }
  };

  const handleResendInvitation = async () => {
    setResendingInvitation(true);
    try {
      await resendInvitation(clientId);
      showToast("Invitación reenviada por correo.", "success");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error.", "error");
    } finally { setResendingInvitation(false); }
  };

  const handleApproveBaseline = async () => {
    setApprovingBaseline(true);
    try { setClient(await approveBaseline(clientId)); showToast("Baseline aprobado.", "success"); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error.", "error"); }
    finally { setApprovingBaseline(false); }
  };

  const handleApproveWearable = async () => {
    setApprovingWearable(true);
    try { setClient(await approveWearable(clientId)); showToast("Wearable aprobado.", "success"); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error.", "error"); }
    finally { setApprovingWearable(false); }
  };

  const handleApprovePayment = async (paymentId: string) => {
    setActing(true);
    try {
      setClient(await approveMembershipPayment(clientId, paymentId));
      await load();
      showToast("Pago aprobado — membresía activada.", "success");
    }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error.", "error"); }
    finally { setActing(false); }
  };

  if (loading) return <p style={{ color: "var(--eph-muted)" }}>Cargando…</p>;
  if (error || !client) return <p style={{ color: "#D99483" }}>{error || "Cliente no encontrado."}</p>;

  const latestPayment = payments[0] ?? null;
  const pendingApprovalPayment = payments.find((p) => p.status === "succeeded" && p.requiresApproval && !p.appliedAt) ?? null;

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 28,
        fontWeight: 400, color: "var(--eph-text)", margin: "0 0 4px" }}>{client.name}</h1>
      <p style={{ fontSize: 14, color: "var(--eph-muted)", margin: "0 0 24px" }}>{client.email}</p>
      <button onClick={() => router.push("/admin/clients")}
        style={{ background: "none", border: "none", color: "var(--eph-muted)",
          fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0, marginBottom: 24,
          textDecoration: "underline", textUnderlineOffset: 4 }}>
        ← Volver a clientes</button>

      {/* Cuenta card */}
      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>Cuenta</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
          <div>
            <span style={labelStyle}>Estado</span>
            <span style={{ display: "inline-block", padding: "4px 12px",
              borderRadius: "9999px", fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
              fontSize: 10, fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.06em",
              background: client.status === "inactive" ? "var(--eph-line)" : "rgba(201,166,107,.14)",
              color: client.status === "inactive" ? "var(--eph-muted)" : "var(--eph-accent)" }}>
              {client.status}</span>
            <div style={{ marginTop: 10 }}>
              {client.status === "inactive" ? (
                <button onClick={handleActivate} disabled={acting}
                  style={{ ...pillButtonStyle, border: "1px solid var(--eph-accent)",
                    background: "transparent", color: "var(--eph-accent)",
                    cursor: acting ? "not-allowed" : "pointer", opacity: acting ? 0.6 : 1 }}>
                  Activar cliente</button>
              ) : (
                <button onClick={handleDeactivate} disabled={acting}
                  style={{ ...pillButtonStyle, border: "1px solid var(--eph-danger)",
                    background: "transparent", color: "#D99483",
                    cursor: acting ? "not-allowed" : "pointer", opacity: acting ? 0.6 : 1 }}>
                  Desactivar cliente</button>
              )}
            </div>
          </div>
          <div>
            <span style={labelStyle}>Tipo de cliente</span>
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}
              style={{ ...inputStyle, height: 44 }}>
              <option value="">Sin clasificar</option>
              <option value="coaching_1_1">Cliente 1:1</option>
              <option value="mentoring">Premium</option>
            </select>
            <button onClick={handleSaveType} disabled={acting}
              style={{ ...pillButtonStyle, marginTop: 10,
                border: "1px solid var(--eph-line-2)", background: "transparent",
                color: "var(--eph-body)",
                cursor: acting ? "not-allowed" : "pointer" }}>
              Guardar tipo</button>
          </div>
          {client.hasPendingInvitation && (
            <div>
              <span style={labelStyle}>Invitación</span>
              <span style={{ display: "inline-block", padding: "4px 12px",
                borderRadius: "9999px", fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                fontSize: 10, fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.06em",
                background: "var(--eph-line)", color: "var(--eph-text)" }}>
                Pendiente de crear contraseña</span>
              <div style={{ marginTop: 10 }}>
                <button onClick={handleResendInvitation} disabled={resendingInvitation}
                  style={{ ...pillButtonStyle, border: "1px solid var(--eph-line-2)",
                    background: "transparent", color: "var(--eph-body)",
                    cursor: resendingInvitation ? "not-allowed" : "pointer" }}>
                  {resendingInvitation ? "Reenviando…" : "Reenviar invitación"}</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Membresía card */}
      <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Membresía</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
            <div>
              <span style={labelStyle}>Plan contratado</span>
              <span style={{ display: "inline-block", padding: "4px 12px",
                borderRadius: "9999px", fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                fontSize: 10, fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.06em",
                background: "var(--eph-surface-2)", color: "var(--eph-text)" }}>
                {client.planDurationDays ? `${client.planDurationDays} días` : "Sin plan"}</span>
            </div>
            <div>
              <span style={labelStyle}>Inicio</span>
              <span style={{ fontSize: 14, color: "var(--eph-text)" }}>
                {client.planStartDate || "-"}</span>
            </div>
            <div>
              <span style={labelStyle}>Vence</span>
              <span style={{ fontSize: 14, color: "var(--eph-text)" }}>
                {client.planEndDate || "-"}</span>
            </div>
            {client.clientType === "coaching_1_1" && client.sessionsTotal != null && (
              <div>
                <span style={labelStyle}>Clases</span>
                <span style={{ fontSize: 14, color: "var(--eph-text)" }}>
                  Quedan {client.sessionsRemaining} de {client.sessionsTotal}</span>
              </div>
            )}
            {latestPayment && (
              <>
                <div>
                  <span style={labelStyle}>Proveedor</span>
                  <span style={{ fontSize: 14, color: "var(--eph-text)", textTransform: "capitalize" }}>{latestPayment.provider}</span>
                </div>
                <div>
                  <span style={labelStyle}>Último monto pagado</span>
                  <span style={{ fontSize: 14, color: "var(--eph-text)" }}>{formatMoney(latestPayment.amountCents, latestPayment.currency)}</span>
                </div>
                <div>
                  <span style={labelStyle}>Plan pagado</span>
                  <span style={{ fontSize: 14, color: "var(--eph-text)" }}>{formatPlanDetail(latestPayment)}</span>
                </div>
                {latestPayment.trmUsed != null && (
                  <>
                    <div>
                      <span style={labelStyle}>TRM usada (puente Premium)</span>
                      <span style={{ fontSize: 14, color: "var(--eph-text)" }}>${Number(latestPayment.trmUsed).toLocaleString("es-CO")} COP{latestPayment.trmDate ? ` · ${latestPayment.trmDate}` : ""}</span>
                    </div>
                    <div>
                      <span style={labelStyle}>Margen aplicado</span>
                      <span style={{ fontSize: 14, color: "var(--eph-text)" }}>{latestPayment.marginApplied != null ? `${(Number(latestPayment.marginApplied) * 100).toFixed(1)}%` : "-"}</span>
                    </div>
                    <div>
                      <span style={labelStyle}>USD de referencia vs. cobrado</span>
                      <span style={{ fontSize: 14, color: "var(--eph-text)" }}>$4.000 USD → {formatMoney(latestPayment.amountCents, latestPayment.currency)}</span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
      </div>

      {(client.client_type || client.clientType) === "mentoring" && <CheckinsComplianceCard clientId={clientId} />}

      {/* Pago pendiente de aprobación — primera membresía paga del cliente */}
      {pendingApprovalPayment && (
        <div style={{ ...cardStyle, border: "1px solid var(--eph-danger)", background: "rgba(138,74,60,.14)" }}>
          <h3 style={{ ...cardTitleStyle, color: "#D99483" }}>Pago recibido, pendiente de aprobación</h3>
          <p style={{ fontSize: 13, color: "#D99483", margin: "0 0 14px" }}>
            {client.name} pagó {formatMoney(pendingApprovalPayment.amountCents, pendingApprovalPayment.currency)} por primera vez
            ({pendingApprovalPayment.clientType}) vía {pendingApprovalPayment.provider}, confirmado el {pendingApprovalPayment.succeededAt ? formatDateEs(pendingApprovalPayment.succeededAt) : "-"}.
            Como es su primera membresía paga, no se activa sola — revisala y aprobala acá.
          </p>
          <button onClick={() => handleApprovePayment(pendingApprovalPayment.id)} disabled={acting}
            style={{ ...pillButtonStyle, border: "1px solid var(--eph-accent)",
              background: "transparent", color: "var(--eph-accent)",
              cursor: acting ? "not-allowed" : "pointer", opacity: acting ? 0.6 : 1 }}>
            Aprobar y activar</button>
        </div>
      )}

      {/* Historial de pagos */}
      {payments.length > 0 && (
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Historial de pagos</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Fecha", "Tier", "Plan", "Monto", "Proveedor", "Estado"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                      fontSize: 10, fontWeight: 400, letterSpacing: "0.1em",
                      color: "var(--eph-muted)", textTransform: "uppercase", borderBottom: "1px solid var(--eph-line)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--eph-line)" }}>
                    <td style={{ padding: "8px 10px", color: "var(--eph-text)" }}>{formatDateEs(p.createdAt)}</td>
                    <td style={{ padding: "8px 10px", color: "var(--eph-text)" }}>{p.clientType}</td>
                    <td style={{ padding: "8px 10px", color: "var(--eph-text)" }}>{formatPlanDetail(p)}</td>
                    <td style={{ padding: "8px 10px", color: "var(--eph-text)" }}>{formatMoney(p.amountCents, p.currency)}</td>
                    <td style={{ padding: "8px 10px", color: "var(--eph-text)", textTransform: "capitalize" }}>{p.provider}</td>
                    <td style={{ padding: "8px 10px", color: "var(--eph-text)" }}>{PAYMENT_STATUS_LABELS[p.status] ?? p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Solicitud de eliminación de cuenta */}
      {client.deletionRequestedAt && (
        <div style={{ ...cardStyle, border: "1px solid var(--eph-danger)", background: "rgba(138,74,60,.14)" }}>
          <h3 style={{ ...cardTitleStyle, color: "#D99483" }}>Solicitud de eliminación pendiente</h3>
          <p style={{ fontSize: 13, color: "#D99483", margin: "0 0 14px" }}>
            {client.name} solicitó eliminar su cuenta el {new Date(client.deletionRequestedAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}.
            Contáctalo antes de procesar cualquier cambio.
          </p>
          <button onClick={handleResolveDeletionRequest} disabled={acting}
            style={{ ...pillButtonStyle, border: "1px solid var(--eph-danger)",
              background: "transparent", color: "#D99483",
              cursor: acting ? "not-allowed" : "pointer", opacity: acting ? 0.6 : 1 }}>
            Marcar como resuelta</button>
        </div>
      )}

      {/* Segmentación — solo Mentoría, alimenta el benchmark comparativo anonimizado */}
      {(client.client_type || client.clientType) === "mentoring" && (
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Segmentación (Premium)</h3>
          <p style={{ fontSize: 12.5, color: "var(--eph-muted)", margin: "-8px 0 14px" }}>
            Se usa para el benchmark comparativo anonimizado entre clientes Premium — nunca se le muestra a nadie con el nombre de este cliente.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <div>
              <span style={labelStyle}>Tipo de cargo</span>
              <select value={cargoType} onChange={(e) => setCargoType(e.target.value)} style={{ ...inputStyle, height: 40 }}>
                <option value="">Sin clasificar</option>
                {MENTORING_CARGO_TYPES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <span style={labelStyle}>Sector</span>
              <select value={sector} onChange={(e) => setSector(e.target.value)} style={{ ...inputStyle, height: 40 }}>
                <option value="">Sin clasificar</option>
                {MENTORING_SECTORS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>
          <button onClick={handleSaveSegmentation} disabled={savingSegmentation}
            style={{ ...pillButtonStyle, marginTop: 14,
              border: "1px solid var(--eph-line-2)", background: "transparent",
              color: "var(--eph-body)",
              cursor: savingSegmentation ? "not-allowed" : "pointer" }}>
            Guardar segmentación</button>
        </div>
      )}

      {/* Onboarding obligatorio Mentoría — aprobación independiente de baseline/wearable/laboratorio semana 0 */}
      {(client.client_type || client.clientType) === "mentoring" && (
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Onboarding Premium</h3>
          {client.week1ActivatedAt && (
            <p className="font-mono" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--eph-accent)", margin: "-8px 0 14px" }}>
              ✓ Semana 1 activada el {new Date(client.week1ActivatedAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}

          <div style={{ marginBottom: 20 }}>
            <span style={labelStyle}>Baseline (cuestionario + InBody)</span>
            {client.baselineApprovedAt ? (
              <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 9999, fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace", fontSize: 10, fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.06em", background: "rgba(201,166,107,.14)", color: "var(--eph-accent)" }}>
                Aprobado el {new Date(client.baselineApprovedAt).toLocaleDateString("es-ES")}
              </span>
            ) : (
              <div style={{ marginTop: 6 }}>
                <button onClick={handleApproveBaseline} disabled={approvingBaseline}
                  style={{ ...pillButtonStyle, border: "1px solid var(--eph-accent)",
                    background: "transparent", color: "var(--eph-accent)",
                    cursor: approvingBaseline ? "not-allowed" : "pointer", opacity: approvingBaseline ? 0.6 : 1 }}>
                  {approvingBaseline ? "Aprobando…" : "Aprobar baseline"}
                </button>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <span style={labelStyle}>Wearable</span>
            {client.wearableApprovedAt ? (
              <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 9999, fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace", fontSize: 10, fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.06em", background: "rgba(201,166,107,.14)", color: "var(--eph-accent)" }}>
                Aprobado el {new Date(client.wearableApprovedAt).toLocaleDateString("es-ES")}
              </span>
            ) : client.wearableBaselineReadyAt ? (
              <div style={{ marginTop: 6 }}>
                <button onClick={handleApproveWearable} disabled={approvingWearable}
                  style={{ ...pillButtonStyle, border: "1px solid var(--eph-accent)",
                    background: "transparent", color: "var(--eph-accent)",
                    cursor: approvingWearable ? "not-allowed" : "pointer", opacity: approvingWearable ? 0.6 : 1 }}>
                  {approvingWearable ? "Aprobando…" : "Aprobar wearable"}
                </button>
              </div>
            ) : (
              <span style={{ fontSize: 12.5, color: "var(--eph-muted)" }}>
                Todavía no alcanza los 7 días mínimos de datos.
              </span>
            )}
          </div>

          <div>
            <span style={labelStyle}>Laboratorio Semana 0</span>
            <div style={{ marginTop: 6 }}>
              <AdminLabPanelReview
                clientId={clientId}
                semana={0}
                panel={labPanels.find((p) => p.semanaNumero === 0)}
                onApproved={load}
              />
            </div>
          </div>
        </div>
      )}

      {/* Resumen onboarding */}
      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>Resumen de onboarding</h3>
        <OnboardingSummaryAccordion
          personalInfo={personalInfo}
          clientType={client.client_type || client.clientType || null}
          clientId={clientId}
        />
      </div>
    </div>
  );
}