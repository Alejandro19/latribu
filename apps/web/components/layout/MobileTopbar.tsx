"use client";

type MobileTopbarProps = {
  onToggleSidebar: () => void;
};

export default function MobileTopbar({ onToggleSidebar }: MobileTopbarProps) {
  return (
    <div
      className="mobile-topbar"
      style={{
        display: "none",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        background: "var(--paper)",
        borderBottom: "1px solid var(--line)",
        position: "sticky",
        top: 0,
        zIndex: 60,
      }}
    >
      <button
        onClick={onToggleSidebar}
        aria-label="Abrir menú"
        style={{
          background: "none",
          border: "none",
          padding: 6,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          cursor: "pointer",
        }}
      >
        <span style={{ display: "block", width: 22, height: 2, background: "var(--ink)", borderRadius: 2 }} />
        <span style={{ display: "block", width: 22, height: 2, background: "var(--ink)", borderRadius: 2 }} />
        <span style={{ display: "block", width: 22, height: 2, background: "var(--ink)", borderRadius: 2 }} />
      </button>
      <div
        className="brand"
        style={{ margin: 0, fontSize: 18, fontFamily: "Fraunces, Georgia, serif", fontWeight: 700, color: "var(--ink)" }}
      >
        La Tribu
      </div>
      <style jsx>{`
        @media (max-width: 900px) {
          .mobile-topbar {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}