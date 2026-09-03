"use client";

import { useState } from "react";

type AccordionItem = { header: React.ReactNode; content: React.ReactNode; defaultOpen?: boolean };

type AccordionProps = {
  items: AccordionItem[];
  className?: string;
};

export default function Accordion({ items }: AccordionProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div style={{ border: "1px solid var(--eph-line)", borderRadius: 0, overflow: "hidden", background: "var(--eph-surface)" }}>
      {items.map((item, i) => {
        const open = openIdx === i;
        return (
          <div key={i} style={{ borderBottom: i < items.length - 1 ? "1px solid var(--eph-line)" : "none" }}>
            <button
              className="font-display"
              onClick={() => setOpenIdx(open ? null : i)}
              style={{
                width: "100%", textAlign: "left", padding: "16px 18px",
                background: open ? "var(--eph-surface-2)" : "var(--eph-surface)",
                border: "none", cursor: "pointer", fontWeight: 400,
                display: "flex", justifyContent: "space-between",
                alignItems: "center", fontSize: 16, color: "var(--eph-text)",
              }}
            >
              {item.header}
              <span style={{ fontSize: 12, color: "var(--eph-accent)" }}>
                {open ? "▲" : "▼"}
              </span>
            </button>
            {open && (
              <div style={{ padding: "18px 18px 12px", background: "var(--eph-surface)" }}>
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
