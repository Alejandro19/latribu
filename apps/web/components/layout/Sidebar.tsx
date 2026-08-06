"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import SidebarRing from "./SidebarRing";
import ClientNavItems from "./ClientNavItems";
import AdminNavItems from "./AdminNavItems";
import UserChip from "./UserChip";
import { VIEW_TO_PATH } from "../../lib/constants";
import { useAuth } from "../../lib/auth-context";

type SidebarProps = {
  viewKey: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export default function Sidebar({ viewKey, mobileOpen, onCloseMobile }: SidebarProps) {
  const router = useRouter();
  const { role, clientType, onboardingComplete } = useAuth();

  const navigate = useCallback(
    (key: string) => {
      const path = VIEW_TO_PATH[key] || `/${key}`;
      router.push(path);
      onCloseMobile();
    },
    [router, onCloseMobile],
  );

  const isAdmin = role === "admin";

  if (!role) return null;

  return (
    <aside
      className={mobileOpen ? "open" : ""}
      style={{
        width: 250,
        background: "var(--paper)",
        borderRight: "1px solid var(--line)",
        padding: "28px 18px",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--ink)",
          margin: "0 8px 4px",
          fontFamily: "Fraunces, Georgia, serif",
        }}
      >
        La Tribu
      </div>
      <SidebarRing viewKey={viewKey} />
      <nav id="nav-items" style={{ flex: 1 }}>
        {isAdmin ? (
          <AdminNavItems viewKey={viewKey} onNavigate={navigate} />
        ) : (
          <ClientNavItems
            clientType={clientType}
            onboardingComplete={onboardingComplete}
            viewKey={viewKey}
            onNavigate={navigate}
          />
        )}
      </nav>
      <UserChip />
      <style jsx>{`
        @media (max-width: 900px) {
          aside {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            width: 82vw;
            max-width: 300px;
            z-index: 100;
            transform: translateX(-100%);
            transition: transform 0.28s ease;
          }
          aside.open {
            transform: translateX(0);
            box-shadow: 8px 0 24px rgba(0, 0, 0, 0.18);
          }
        }
      `}</style>
    </aside>
  );
}