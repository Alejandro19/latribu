"use client";

export default function EmptyState({ message = "No hay datos por ahora." }: { message?: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        color: "var(--ink-soft)",
        fontSize: 13,
        padding: "32px 0",
      }}
    >
      {message}
    </div>
  );
}