"use client";

type MantraCardProps = {
  mantra: string;
  lead?: string;
};

export default function MantraCard({ mantra, lead }: MantraCardProps) {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        padding: "18px 22px",
        marginBottom: 20,
        fontStyle: "italic",
        fontFamily: "Fraunces, Georgia, serif",
        fontSize: 16,
        fontWeight: 500,
        color: "var(--ink)",
        lineHeight: 1.5,
      }}
    >
      {lead && (
        <span
          style={{
            display: "block",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontStyle: "normal",
            fontWeight: 600,
            color: "var(--ink-soft)",
            marginBottom: 4,
          }}
        >
          {lead}
        </span>
      )}
      &ldquo;{mantra}&rdquo;
    </div>
  );
}