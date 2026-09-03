"use client";

type MantraCardProps = {
  mantra: string;
  lead?: string;
  author?: string | null;
};

export default function MantraCard({ mantra, lead, author }: MantraCardProps) {
  return (
    <div
      className="font-display"
      style={{
        background: "var(--eph-surface)",
        border: "1px solid var(--eph-line)",
        borderRadius: 0,
        padding: "20px 24px",
        marginBottom: 20,
        fontStyle: "italic",
        fontSize: 17,
        fontWeight: 400,
        color: "var(--eph-text)",
        lineHeight: 1.5,
      }}
    >
      {lead && (
        <span
          className="font-mono"
          style={{
            display: "block",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.16em",
            fontStyle: "normal",
            fontWeight: 400,
            color: "var(--eph-accent)",
            marginBottom: 6,
          }}
        >
          {lead}
        </span>
      )}
      &ldquo;{mantra}&rdquo;
      {author && (
        <span
          className="font-mono"
          style={{
            display: "block",
            marginTop: 8,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            fontStyle: "normal",
            fontWeight: 400,
            color: "var(--eph-muted)",
          }}
        >
          — {author}
        </span>
      )}
    </div>
  );
}
