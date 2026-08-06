"use client";

import { useEffect, useState, useCallback } from "react";
import { getSessionToken } from "../../lib/api-client";
import { showToast } from "../layout/AppShell";

type NotificationItem = {
  id: string;
  message: string;
  created_at: string;
  read: boolean;
  client_id?: string;
};

const API_BASE = "http://localhost:3003/api";

export default function AdminNotificationsPanel() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = getSessionToken();
      const res = await fetch(`${API_BASE}/admin/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success && data.error) throw new Error(data.error);
      setNotifications(data.notifications || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    try {
      const token = getSessionToken();
      await fetch(`${API_BASE}/admin/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      showToast("Notificación marcada como leída.", "success");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error.", "error");
    }
  };

  if (loading) return <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Cargando…</p>;
  if (error) return <p style={{ color: "var(--danger)", fontSize: 14 }}>{error}</p>;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 26,
          fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>Notificaciones</h1>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0 }}>
          Eventos recientes de tus clientes.</p>
      </div>

      <div style={{ background: "var(--paper)", border: "1px solid var(--line)",
        borderRadius: "var(--radius)", overflow: "hidden" }}>
        {notifications.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--ink-soft)", fontSize: 13,
            padding: "32px 0" }}>No hay notificaciones por ahora.</p>
        ) : (
          notifications.map((n) => (
            <div key={n.id} style={{ display: "flex", alignItems: "center",
              justifyContent: "space-between", padding: "14px 20px",
              borderBottom: "1px solid var(--line)", opacity: n.read ? 0.6 : 1 }}>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 13, color: "var(--ink)" }}>{n.message}</strong>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
                  {new Date(n.created_at).toLocaleString("es-ES")}</div>
              </div>
              <div style={{ display: "flex", gap: 8, marginLeft: 16 }}>
                {n.client_id && (
                  <a href={`/admin/clients/${n.client_id}`}
                    style={{ padding: "5px 14px", borderRadius: "9999px",
                      border: "1px solid var(--line)", fontSize: 11, fontWeight: 500,
                      color: "var(--ink-soft)", textDecoration: "none", whiteSpace: "nowrap" }}>
                    Ver cliente</a>
                )}
                {!n.read && (
                  <button onClick={() => markRead(n.id)}
                    style={{ padding: "5px 14px", borderRadius: "9999px",
                      border: "1px solid var(--line)", background: "transparent",
                      fontSize: 11, fontWeight: 500, color: "var(--sage)",
                      cursor: "pointer", whiteSpace: "nowrap" }}>
                    Marcar leída</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}