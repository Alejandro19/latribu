"use client";

type IdentityHeaderProps = {
  title: string;
  subtitle?: string;
};

export default function IdentityHeader({ title, subtitle }: IdentityHeaderProps) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h1
        style={{
          fontFamily: "Fraunces, Georgia, serif",
          fontSize: 30,
          fontWeight: 700,
          margin: "0 0 6px",
          color: "var(--ink)",
          lineHeight: 1.15,
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          style={{
            fontSize: 11,
            color: "var(--ink-soft)",
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 600,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}