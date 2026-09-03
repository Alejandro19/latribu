"use client";

import { useEffect, useState } from "react";
import { updateMembershipPrice, type MembershipPrice } from "../../../lib/membership-client";
import { MEMBERSHIP_LABELS } from "../../../lib/constants";
import { showToast } from "../../layout/AppShell";

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "12px 16px", fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace", fontSize: 10, fontWeight: 400,
  color: "var(--eph-muted)", textTransform: "uppercase",
  letterSpacing: "0.1em", borderBottom: "1px solid var(--eph-line)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px", fontSize: 13, color: "var(--eph-text)", verticalAlign: "middle",
};

const inputStyle: React.CSSProperties = {
  width: 120, height: 32, borderRadius: 0, border: "none",
  borderBottom: "1px solid var(--eph-line-2)", padding: "0 2px 4px",
  fontSize: 14, fontWeight: 600, background: "transparent", color: "var(--eph-text)",
  outline: "none", boxSizing: "border-box",
};

function centsToDollarsInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default function PricingTable({ prices, onSaved }: { prices: MembershipPrice[]; onSaved: () => void }) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    setEdits(Object.fromEntries(prices.map((p) => [p.id, centsToDollarsInput(p.amountCents)])));
  }, [prices]);

  const handleSave = async (price: MembershipPrice) => {
    const dollars = Number(edits[price.id]);
    if (!Number.isFinite(dollars) || dollars < 0) {
      showToast("Ingresa un monto válido.", "error");
      return;
    }
    setSaving(price.id);
    try {
      await updateMembershipPrice(price.id, Math.round(dollars * 100));
      showToast("Precio guardado.", "success");
      onSaved();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error al guardar.", "error");
    } finally {
      setSaving(null);
    }
  };

  const sorted = [...prices].sort((a, b) =>
    a.clientType === b.clientType ? a.durationMonths - b.durationMonths : a.clientType.localeCompare(b.clientType)
  );

  return (
    <div style={{ background: "var(--eph-surface)", border: "1px solid var(--eph-line)", borderRadius: "0", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Membresía", "Duración", "Monto (USD)", ""].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((price) => (
            <tr key={price.id} style={{ borderBottom: "1px solid var(--eph-line)" }}>
              <td style={tdStyle}>{MEMBERSHIP_LABELS[price.clientType] || price.clientType}</td>
              <td style={tdStyle}>{price.durationMonths} {price.durationMonths === 1 ? "mes" : "meses"}</td>
              <td style={tdStyle}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={edits[price.id] ?? ""}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [price.id]: e.target.value }))}
                  style={inputStyle}
                />
              </td>
              <td style={{ ...tdStyle, textAlign: "right" }}>
                <button
                  onClick={() => handleSave(price)}
                  disabled={saving === price.id}
                  style={{
                    padding: "8px 18px", borderRadius: 0, border: "1px solid var(--eph-line-2)",
                    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                    background: "transparent", color: "var(--eph-body)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em",
                    cursor: saving === price.id ? "not-allowed" : "pointer", opacity: saving === price.id ? 0.6 : 1,
                  }}
                >
                  Guardar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
