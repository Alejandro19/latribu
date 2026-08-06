"use client";

type DayTileProps = {
  num: number;
  label?: string;
  state: "active" | "completed" | "locked";
  exerciseCount?: number;
  onClick?: () => void;
};

export default function DayTile({ num, label, state, exerciseCount, onClick }: DayTileProps) {
  const bg =
    state === "completed"
      ? "var(--sage-soft)"
      : state === "locked"
        ? "#F0EBE0"
        : "var(--paper)";
  const borderColor =
    state === "active"
      ? "var(--terracota)"
      : state === "completed"
        ? "var(--terracota)"
        : "#E7DFC9";
  const opacity = state === "locked" ? 0.5 : 1;

  return (
    <button
      onClick={onClick}
      disabled={state === "locked"}
      style={{
        background: bg,
        border: `2px solid ${state === "completed" ? "var(--terracota)" : borderColor}`,
        borderRadius: 16,
        padding: "20px 14px",
        textAlign: "center",
        cursor: state === "locked" ? "not-allowed" : "pointer",
        opacity,
        transition: "border-color .2s ease, box-shadow .2s ease",
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) => {
        if (state !== "locked") {
          e.currentTarget.style.borderColor = "#B8935A";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(184,147,90,.15)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = borderColor;
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          fontFamily: "Fraunces, Georgia, serif",
          fontSize: 22,
          fontWeight: 600,
          color: "var(--ink)",
        }}
      >
        {num}
      </div>
      {label && (
        <div style={{ fontSize: 10, color: "#8A8377", marginTop: 4, fontWeight: 500 }}>
          {label}
        </div>
      )}
      {exerciseCount != null && (
        <div style={{ fontSize: 10, color: "#8A8377", marginTop: 4 }}>
          {exerciseCount} ejercicios
        </div>
      )}
    </button>
  );
}
