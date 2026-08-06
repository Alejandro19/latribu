"use client";

type CategoryTileProps = {
  label: string;
  iconSvg?: React.ReactNode;
  state: "active" | "done" | "default" | "locked";
  exerciseCount?: number;
  onClick?: () => void;
};

export default function CategoryTile({
  label,
  iconSvg,
  state,
  exerciseCount,
  onClick,
}: CategoryTileProps) {
  const locked = state === "locked";
  const done = state === "done";
  const active = state === "active";
  const iconColor = done || active ? "#5B7A4E" : "#8A8377";

  return (
    <button
      onClick={onClick}
      disabled={locked}
      style={{
        background: done ? "#F4F8EF" : locked ? "#F0EBE0" : "var(--paper)",
        border: done || active ? "2px solid #5B7A4E" : "1px solid #E7DFC9",
        borderRadius: 16,
        padding: "20px 14px",
        textAlign: "center",
        cursor: locked ? "not-allowed" : "pointer",
        opacity: locked ? 0.45 : 1,
        transition: "border-color .2s ease, box-shadow .2s ease",
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) => {
        if (!locked) {
          e.currentTarget.style.borderColor = "#B8935A";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(184,147,90,.15)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = done || active ? "#5B7A4E" : "#E7DFC9";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {iconSvg && (
        <div style={{ color: iconColor, marginBottom: 6 }}>{iconSvg}</div>
      )}
      <div
        style={{
          fontFamily: "Fraunces, Georgia, serif",
          fontSize: 15,
          fontWeight: 600,
          color: "var(--ink)",
          marginTop: 8,
        }}
      >
        {label}
      </div>
      {exerciseCount != null && (
        <div style={{ fontSize: 10, color: "#8A8377", marginTop: 4 }}>
          {exerciseCount} ejercicios
        </div>
      )}
    </button>
  );
}
