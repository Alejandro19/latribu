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
    <div style={{ border: "1px solid var(--line)", borderRadius: 18, overflow: "hidden", background: "var(--paper)" }}>
      {items.map((item, i) => {
        const open = openIdx === i;
        return (
          <div key={i} style={{ borderBottom: i < items.length - 1 ? "1px solid var(--line)" : "none" }}>
            <button
              onClick={() => setOpenIdx(open ? null : i)}
              style={{
                width: "100%", textAlign: "left", padding: "16px 18px",
                background: open ? "var(--cream)" : "var(--cream)",
                border: "none", cursor: "pointer", fontWeight: 700,
                display: "flex", justifyContent: "space-between",
                alignItems: "center", fontSize: 15, color: "var(--ink)",
              }}
            >
              {item.header}
              <span style={{ fontSize: 14, color: "var(--terracota)" }}>
                {open ? "▲" : "▼"}
              </span>
            </button>
            {open && (
              <div style={{ padding: "18px 18px 12px", background: "var(--paper)" }}>
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
