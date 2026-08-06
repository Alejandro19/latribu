"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchClients,
  createClient,
  type ClientSummary,
} from "../../lib/clients-client";
import { CLIENT_TYPE_LABELS } from "../../lib/constants";
import { showToast } from "../layout/AppShell";

function isPlanExpired(c: ClientSummary): boolean {
  if (!c.plan_end_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(c.plan_end_date + "T00:00:00") < today;
}

function statusBadgeStyle(status: string): React.CSSProperties {
  return {
    display: "inline-block", padding: "3px 10px", borderRadius: "9999px",
    fontSize: 11, fontWeight: 600,
    background: status === "inactive" ? "var(--terracota-soft)" : "var(--sage-soft)",
    color: status === "inactive" ? "var(--terracota)" : "var(--sage)",
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 44, borderRadius: "var(--radius)",
  border: "1px solid var(--line)", padding: "0 14px", fontSize: 14,
  background: "var(--cream)", color: "var(--ink)", outline: "none",
  boxSizing: "border-box",
};

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 600,
  color: "var(--ink-soft)", textTransform: "uppercase",
  letterSpacing: "0.04em", borderBottom: "1px solid var(--line)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px", fontSize: 13, color: "var(--ink)",
  verticalAlign: "middle",
};

export default function AdminClientList() {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setClients(await fetchClients()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Error al cargar."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName || !newEmail || !newPassword) {
      showToast("Completa todos los campos.", "error"); return;
    }
    setCreating(true);
    try {
      await createClient({ name: newName, email: newEmail, password: newPassword });
      setNewName(""); setNewEmail(""); setNewPassword("");
      showToast("Cliente creado correctamente.", "success");
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error al crear cliente.", "error");
    } finally { setCreating(false); }
  };

  if (loading) return <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Cargando clientes…</p>;
  if (error) return <p style={{ color: "var(--danger)", fontSize: 14 }}>{error}</p>;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 26,
          fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>Clientes</h1>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0 }}>
          Gestiona los miembros de La Tribu.</p>
      </div>

      {/* New client card */}
      <div style={{ background: "var(--paper)", border: "1px solid var(--line)",
        borderRadius: "var(--radius)", padding: "24px", marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)",
          margin: "0 0 16px" }}>Nuevo cliente</h3>
        <div style={{ display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 14, marginBottom: 16 }}>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600,
            color: "var(--ink-soft)", marginBottom: 4 }}>Nombre</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre completo" style={inputStyle} /></div>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600,
            color: "var(--ink-soft)", marginBottom: 4 }}>Email</label>
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              placeholder="correo@ejemplo.com" style={inputStyle} /></div>
          <div><label style={{ display: "block", fontSize: 12, fontWeight: 600,
            color: "var(--ink-soft)", marginBottom: 4 }}>Contraseña</label>
            <input type="password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••" style={inputStyle} /></div>
        </div>
        <button onClick={handleCreate} disabled={creating}
          style={{ display: "inline-flex", alignItems: "center", gap: 6,
            borderRadius: "9999px", background: "var(--gold)", color: "#fff",
            border: "none", padding: "10px 24px", fontSize: 13, fontWeight: 600,
            cursor: creating ? "not-allowed" : "pointer",
            opacity: creating ? 0.7 : 1 }}>
          {creating ? "Creando…" : "Crear cliente"}</button>
      </div>

      {/* Table card */}
      <div style={{ background: "var(--paper)", border: "1px solid var(--line)",
        borderRadius: "var(--radius)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>{["Nombre","Email","Estado","Tipo","Vence",""].map(h => (
              <th key={h} style={thStyle}>{h}</th>))}</tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const ct = c.client_type || c.clientType;
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={tdStyle}><span style={{ fontWeight: 600 }}>{c.name}</span></td>
                  <td style={tdStyle}><span style={{ color: "var(--ink-soft)", fontSize: 13 }}>{c.email}</span></td>
                  <td style={tdStyle}><span style={statusBadgeStyle(c.status)}>{c.status}</span></td>
                  <td style={tdStyle}>{CLIENT_TYPE_LABELS[ct] || "-"}</td>
                  <td style={tdStyle}>{ct === "lead_wellness" ? "-" :
                    c.plan_end_date ? <span style={{ display: "inline-block",
                      padding: "3px 10px", borderRadius: "9999px", fontSize: 11, fontWeight: 600,
                      background: isPlanExpired(c) ? "var(--terracota-soft)" : "var(--sage-soft)",
                      color: isPlanExpired(c) ? "var(--terracota)" : "var(--sage)" }}>
                      {c.plan_end_date}</span> : "-"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <a href={`/admin/clients/${c.id}`}
                      style={{ display: "inline-flex", alignItems: "center",
                        padding: "6px 14px", borderRadius: "9999px",
                        border: "1px solid var(--line)", fontSize: 12, fontWeight: 500,
                        color: "var(--ink-soft)", textDecoration: "none", whiteSpace: "nowrap" }}>
                      Abrir</a></td>
                </tr>);
            })}
          </tbody>
        </table>
        {clients.length === 0 && <p style={{ textAlign: "center",
          color: "var(--ink-soft)", fontSize: 13, padding: "32px 0" }}>
          No hay clientes registrados.</p>}
      </div>
    </div>
  );
}