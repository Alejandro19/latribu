"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../../lib/auth-context";
import { getSessionToken } from "../../lib/api-client";

type NotificationItem = {
  id: string;
  message: string;
  created_at: string;
  read: boolean;
};

export default function NotificationBell() {
  const { role, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = getSessionToken();
      if (!token || !user?.id) return;

      const url =
        role === "admin"
          ? `http://localhost:3003/api/admin/notifications`
          : `http://localhost:3003/api/clients/${user.id}/notifications`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const items: NotificationItem[] = Array.isArray(data)
          ? data
          : data.notifications ?? [];
        setNotifications(items.slice(0, 20));
        setHasUnread(items.some((n: NotificationItem) => !n.read));
      }
    } catch {
      // Silently fail — notifications are non-critical
    }
  }, [role, user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  return (
    <div ref={bellRef} style={{ position: "relative" }}>
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) fetchNotifications();
        }}
        aria-label="Notificaciones"
        style={{
          position: "relative",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 18,
          color: "var(--ink-soft)",
          padding: "4px 6px",
          opacity: 0.75,
          transition: "opacity 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.75";
        }}
      >
        🔔
        {/* Unread dot — Oura-style gold indicator */}
        {hasUnread && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 4,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--danger)",
            }}
          />
        )}
      </button>

      {/* Dropdown panel — Oura card style: no shadow, subtle border, pill-radius */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: 36,
            right: 0,
            width: 300,
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
            padding: 6,
            zIndex: 50,
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {notifications.length === 0 ? (
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-soft)",
                padding: "16px 10px",
                textAlign: "center",
              }}
            >
              No hay notificaciones
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  fontSize: 12,
                  color: "var(--ink)",
                  padding: "9px 8px",
                  borderBottom: "1px solid var(--line)",
                  lineHeight: 1.4,
                  background: n.read ? "transparent" : "var(--cream)",
                  borderRadius: n.read ? "0" : "8px",
                }}
              >
                <div>{n.message}</div>
                <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 2 }}>
                  {new Date(n.created_at).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
