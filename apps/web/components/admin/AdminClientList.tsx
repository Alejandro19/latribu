"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchClients,
  createClient,
  type ClientSummary,
} from "../../lib/clients-client";
import { adminCreateTherapist } from "../../lib/blindspot-client";
import { CLIENT_TYPE_LABELS } from "../../lib/constants";
import { showToast } from "../layout/AppShell";
import AdminTherapistList from "./AdminTherapistList";

function isPlanExpired(c: ClientSummary): boolean {
  if (!c.planEndDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(c.planEndDate + "T00:00:00") < today;
}

function statusBadgeStyle(status: string): React.CSSProperties {
  return {
    display: "inline-block", padding: "3px 10px", borderRadius: "9999px",
    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
    fontSize: 10, fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.06em",
    background: status === "inactive" ? "var(--eph-line)" : "rgba(201,166,107,.14)",
    color: status === "inactive" ? "var(--eph-muted)" : "var(--eph-accent)",
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 36, borderRadius: 0,
  border: "none", borderBottom: "1px solid var(--eph-line-2)", padding: "0 2px 6px", fontSize: 14.5,
  fontWeight: 600, background: "transparent", color: "var(--eph-text)", outline: "none",
  boxSizing: "border-box",
};

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "12px 16px", fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
  fontSize: 10, fontWeight: 400, color: "var(--eph-muted)", textTransform: "uppercase",
  letterSpacing: "0.1em", borderBottom: "1px solid var(--eph-line)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px", fontSize: 13, color: "var(--eph-text)",
  verticalAlign: "middle",
};

function segmentButtonStyle(active: boolean): React.CSSProperties {
  return {
    height: 36, padding: "0 18px", borderRadius: 0, cursor: "pointer",
    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
    fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
    border: active ? "none" : "1px solid var(--eph-line-2)",
    background: active ? "var(--eph-accent)" : "transparent",
    color: active ? "var(--eph-ink)" : "var(--eph-body)",
  };
}

export default function AdminClientList() {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cliente y terapeuta se registran desde el mismo módulo — antes vivían
  // por separado (terapeuta se creaba desde Punto Ciego → pestaña
  // Terapeutas), cada uno conserva solo los campos que le corresponden.
  const [newEntityType, setNewEntityType] = useState<"cliente" | "terapeuta">("cliente");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newSpecialty, setNewSpecialty] = useState("");
  const [newMustChangePassword, setNewMustChangePassword] = useState(false);
  // Mentoría no pide contraseña acá — se invita por correo y el cliente la
  // crea él mismo desde el link (ver clients.service.ts::createClient).
  const [newClientType, setNewClientType] = useState<"coaching_1_1" | "mentoring">("coaching_1_1");
  const [creating, setCreating] = useState(false);
  // Fuerza a AdminTherapistList a remontarse (y re-pedir su lista) cuando se
  // crea un terapeuta nuevo desde este formulario.
  const [therapistListKey, setTherapistListKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setClients(await fetchClients()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Error al cargar."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const clearNewEntityFields = () => {
    setNewName(""); setNewEmail(""); setNewPassword(""); setNewSpecialty(""); setNewMustChangePassword(false); setNewClientType("coaching_1_1");
  };

  const isMentoring = newEntityType === "cliente" && newClientType === "mentoring";

  const handleCreate = async () => {
    if (!newName || !newEmail || (!isMentoring && !newPassword)) {
      showToast("Completa todos los campos.", "error"); return;
    }
    setCreating(true);
    try {
      if (newEntityType === "terapeuta") {
        if (newPassword.length < 8) {
          showToast("La contraseña temporal debe tener al menos 8 caracteres.", "error");
          setCreating(false);
          return;
        }
        await adminCreateTherapist({ name: newName, email: newEmail, password: newPassword, specialty: newSpecialty || undefined });
        clearNewEntityFields();
        showToast("Terapeuta creado. Esa contraseña es temporal — deberá cambiarla en su primer ingreso.", "success");
        setTherapistListKey((k) => k + 1);
      } else if (isMentoring) {
        await createClient({ name: newName, email: newEmail, client_type: "mentoring" });
        clearNewEntityFields();
        showToast("Cliente creado. Le enviamos una invitación por correo para crear su contraseña.", "success");
        await load();
      } else {
        await createClient({ name: newName, email: newEmail, password: newPassword, mustChangePassword: newMustChangePassword, client_type: newClientType });
        clearNewEntityFields();
        showToast(
          newMustChangePassword
            ? "Cliente creado. Esa contraseña es temporal — deberá cambiarla en su próximo ingreso."
            : "Cliente creado correctamente.",
          "success"
        );
        await load();
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : `Error al crear ${newEntityType}.`, "error");
    } finally { setCreating(false); }
  };

  if (loading) return <p style={{ color: "var(--eph-muted)", fontSize: 14 }}>Cargando clientes…</p>;
  if (error) return <p style={{ color: "#D99483", fontSize: 14 }}>{error}</p>;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 28,
          fontWeight: 400, color: "var(--eph-text)", margin: "0 0 6px" }}>Clientes</h1>
        <p className="font-mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--eph-muted)", margin: 0 }}>
          Gestiona los miembros de Ephirox.</p>
      </div>

      {/* Nuevo cliente / terapeuta */}
      <div style={{
        background: "var(--eph-surface)", border: "1px solid var(--eph-line)",
        borderRadius: "0", padding: "22px 24px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <h3 style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 18, fontWeight: 400, color: "var(--eph-text)", margin: 0 }}>
            {newEntityType === "terapeuta" ? "Nuevo terapeuta" : "Nuevo cliente"}
          </h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={segmentButtonStyle(newEntityType === "cliente")}
              onClick={() => { setNewEntityType("cliente"); clearNewEntityFields(); }}>
              Cliente
            </button>
            <button type="button" style={segmentButtonStyle(newEntityType === "terapeuta")}
              onClick={() => { setNewEntityType("terapeuta"); clearNewEntityFields(); }}>
              Terapeuta
            </button>
          </div>
        </div>
        <div style={{ display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 14, marginBottom: 16 }}>
          <div><label htmlFor="new-entity-name" className="font-mono" style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 400,
            color: "var(--eph-muted)", marginBottom: 6 }}>Nombre</label>
            <input id="new-entity-name" value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre completo" style={inputStyle} /></div>
          <div><label htmlFor="new-entity-email" className="font-mono" style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 400,
            color: "var(--eph-muted)", marginBottom: 6 }}>Email</label>
            <input id="new-entity-email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              placeholder="correo@ejemplo.com" style={inputStyle} /></div>
          {newEntityType === "cliente" && (
            <div><label htmlFor="new-entity-client-type" className="font-mono" style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 400,
              color: "var(--eph-muted)", marginBottom: 6 }}>Tipo</label>
              <select id="new-entity-client-type" value={newClientType}
                onChange={(e) => setNewClientType(e.target.value as "coaching_1_1" | "mentoring")}
                style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="coaching_1_1">Cliente 1:1</option>
                <option value="mentoring">Premium</option>
              </select></div>
          )}
          {!isMentoring && (
            <div><label htmlFor="new-entity-password" className="font-mono" style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 400,
              color: "var(--eph-muted)", marginBottom: 6 }}>
                {newEntityType === "terapeuta" ? "Contraseña temporal" : "Contraseña"}</label>
              <input id="new-entity-password" type={newEntityType === "terapeuta" ? "text" : "password"} value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={newEntityType === "terapeuta" ? "Mínimo 8 caracteres" : "••••••••"}
                style={inputStyle} /></div>
          )}
          {newEntityType === "terapeuta" && (
            <div><label htmlFor="new-entity-specialty" className="font-mono" style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 400,
              color: "var(--eph-muted)", marginBottom: 6 }}>Especialidad</label>
              <input id="new-entity-specialty" value={newSpecialty} onChange={(e) => setNewSpecialty(e.target.value)}
                placeholder="Biodescodificación" style={inputStyle} /></div>
          )}
        </div>
        {newEntityType === "cliente" && !isMentoring && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13,
            color: "var(--eph-muted)", cursor: "pointer", userSelect: "none", marginBottom: 16 }}>
            <input type="checkbox" checked={newMustChangePassword}
              onChange={(e) => setNewMustChangePassword(e.target.checked)} />
            Contraseña temporal — deberá definir una nueva en su próximo ingreso
          </label>
        )}
        {isMentoring && (
          <p style={{ fontSize: 12.5, color: "var(--eph-muted)", marginBottom: 16 }}>
            Se le enviará un correo de invitación con un enlace para crear su contraseña (vence en 7 días).
          </p>
        )}
        <button onClick={handleCreate} disabled={creating} className="font-mono"
          style={{ display: "inline-flex", alignItems: "center", gap: 6,
            borderRadius: 0, background: "var(--eph-accent)", color: "var(--eph-ink)",
            border: "none", padding: "11px 24px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em",
            cursor: creating ? "not-allowed" : "pointer",
            opacity: creating ? 0.7 : 1 }}>
          {creating ? "Creando…" : newEntityType === "terapeuta" ? "Crear terapeuta" : "Crear cliente"}</button>
      </div>

      {/* Tabla de clientes */}
      <div style={{
        background: "var(--eph-surface)", border: "1px solid var(--eph-line)",
        borderRadius: "0", padding: "22px 24px",
      }}>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
          <thead>
            <tr>{["Nombre","Email","Estado","Tipo","Vence","Baseline","Wearable","Lab. Semana 0",""].map(h => (
              <th key={h} style={thStyle}>{h}</th>))}</tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const ct = c.client_type || c.clientType;
              const isMentoring = ct === "mentoring";
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--eph-line)" }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    {c.deletionRequestedAt && (
                      <span style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: "#A6533F", marginTop: 2 }}>
                        Solicitó eliminar su cuenta
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}><span style={{ color: "var(--eph-muted)", fontSize: 13 }}>{c.email}</span></td>
                  <td style={tdStyle}><span style={statusBadgeStyle(c.status)}>{c.status}</span></td>
                  <td style={tdStyle}>{CLIENT_TYPE_LABELS[ct] || "-"}</td>
                  <td style={tdStyle}>{
                    c.planEndDate ? <span style={{ display: "inline-block",
                      padding: "3px 10px", borderRadius: "9999px", fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                      fontSize: 10, fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.06em",
                      background: isPlanExpired(c) ? "rgba(138,74,60,.14)" : "rgba(201,166,107,.14)",
                      color: isPlanExpired(c) ? "#D99483" : "var(--eph-accent)" }}>
                      {c.planEndDate}</span> : "-"}</td>
                  <td style={tdStyle}>{!isMentoring ? "-" : (
                    <span style={{ color: c.baselineComplete ? "var(--eph-accent)" : "var(--eph-muted)", fontWeight: c.baselineComplete ? 600 : 400 }}>
                      {c.baselineComplete ? "Completo" : "Incompleto"}
                    </span>
                  )}</td>
                  <td style={tdStyle}>{!isMentoring ? "-" : (
                    <span style={{ color: c.wearableBaselineReadyAt ? "var(--eph-accent)" : "var(--eph-muted)", fontWeight: c.wearableBaselineReadyAt ? 600 : 400 }}>
                      {c.wearableBaselineReadyAt ? "Completo" : `${c.wearableDaysConDatos ?? 0}/7 días`}
                    </span>
                  )}</td>
                  <td style={tdStyle}>{!isMentoring ? "-" : (
                    <span style={{ color: c.labWeek0Status === "aprobado" ? "var(--eph-accent)" : "var(--eph-muted)", fontWeight: c.labWeek0Status === "aprobado" ? 600 : 400 }}>
                      {c.labWeek0Status === "en_revision" ? "En revisión" : c.labWeek0Status === "aprobado" ? "Aprobado" : c.labWeek0Status === "pendiente" ? "Subido" : "Pendiente"}
                    </span>
                  )}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <a href={`/admin/clients/${c.id}`}
                      style={{ display: "inline-flex", alignItems: "center",
                        padding: "6px 14px", borderRadius: "9999px",
                        border: "1px solid var(--eph-line)", fontSize: 12, fontWeight: 500,
                        color: "var(--eph-muted)", textDecoration: "none", whiteSpace: "nowrap" }}>
                      Abrir</a></td>
                </tr>);
            })}
          </tbody>
        </table>
        </div>
        {clients.length === 0 && <p style={{ textAlign: "center",
          color: "var(--eph-muted)", fontSize: 13, padding: "32px 0" }}>
          No hay clientes registrados.</p>}
      </div>

      <AdminTherapistList key={therapistListKey} />
    </div>
  );
}