"use client";

type IdentityHeaderProps = {
  title: string;
  subtitle?: string;
};

export default function IdentityHeader({ title, subtitle }: IdentityHeaderProps) {
  return (
    <div
      className="font-display"
      style={{ marginBottom: 26, paddingBottom: 32, borderBottom: "1px solid var(--eph-line-2)" }}
    >
      <h1
        style={{
          fontSize: "clamp(40px, 5vw, 58px)",
          fontWeight: 300,
          lineHeight: 1,
          margin: "0 0 16px",
          color: "var(--eph-text)",
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          className="font-mono"
          style={{
            fontSize: 10,
            color: "var(--eph-body)",
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            fontWeight: 300,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
