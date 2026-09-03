"use client";

import { CLIENT_TYPE_LABELS } from "../../../lib/constants";
import { CLIENT_TYPES, type ClientTypeCounts } from "@latribu/shared-types";

type RolesCountCardsProps = {
  counts: ClientTypeCounts | null;
};

const cardBase: React.CSSProperties = {
  borderRadius: "0",
  border: "1px solid var(--eph-line)",
  padding: "16px 18px",
  background: "var(--eph-surface)",
  minWidth: 150,
  flex: "1 1 150px",
};

export default function RolesCountCards({ counts }: RolesCountCardsProps) {
  const cards = [
    ...CLIENT_TYPES.map((clientType) => ({ key: clientType, label: CLIENT_TYPE_LABELS[clientType] ?? clientType, count: counts?.[clientType] ?? 0 })),
    { key: "therapist", label: "Terapeuta", count: counts?.therapist ?? 0 },
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
      {cards.map((card) => {
        const highlighted = card.key === "mentoring";
        return (
          <div
            key={card.key}
            style={{
              ...cardBase,
              background: highlighted ? "rgba(201,166,107,.14)" : cardBase.background,
            }}
          >
            <p style={{ margin: "0 0 6px", fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 400, color: "var(--eph-muted)" }}>{card.label}</p>
            <p style={{ margin: 0, fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 28, fontWeight: 400, color: "var(--eph-text)" }}>
              {counts ? card.count : "—"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
