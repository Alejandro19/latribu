"use client";

import { useState } from "react";
import { IconFileDownload } from "../ui/icons";

type MenuMeal = { name: string; options: { label: string; items: string[] }[] };
type Supplement = { name: string; dose?: string; timing?: string; benefit?: string };

type NutritionPdfGeneratorProps = {
  summary?: string | null;
  dailyCals?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  menu?: MenuMeal[];
  recommendations?: string[];
  closingMessage?: string | null;
  supplements?: Supplement[];
};

const PDF_CSS = `
@page{margin:0}*{box-sizing:border-box}
body{font-family:'Jost',Arial,sans-serif;color:#1C1613;background:#EDE6DC;padding:26mm 20mm 10mm;max-width:760px;margin:0 auto}
.pdf-meal,.pdf-supp-row,.pdf-closing,.pdf-section{break-inside:avoid;page-break-inside:avoid}
.pdf-meal,.pdf-section{padding-top:12mm}
.pdf-header{display:flex;flex-direction:column;align-items:flex-start;text-align:left;margin-top:0}
.pdf-wordmark{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:22pt;line-height:1.25;color:#C9A46A;margin:0}
.pdf-tagline{font-size:9pt;color:#8A8377;margin:4px 0 14px}
.pdf-rule{border:none;border-top:1.5px solid #C9A46A;margin:0 0 40px}
.pdf-title{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:19pt;line-height:1.25;color:#2B2621;margin:0 0 6px;text-align:center}
.pdf-summary{font-size:9.5pt;line-height:1.6;color:#6B6459;text-align:left;max-width:560px;margin:0 0 24px}
.pdf-summary strong{color:#2B2621}
.pdf-macros{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #E7DFC9;border-radius:0;overflow:hidden;margin:0 0 28px}
.pdf-macros>div{padding:12px 6px;text-align:center;border-left:1px solid #E7DFC9}
.pdf-macros>div:first-child{border-left:none}
.pm-val{display:block;font-family:'Cormorant Garamond',serif;font-weight:600;font-size:13pt;color:#2B2621}
.pm-lbl{font-size:8pt;color:#8A8377;text-transform:uppercase;letter-spacing:.04em}
.pdf-meal{margin-bottom:22px}
.pdf-meal-title{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:13pt;line-height:1.25;color:#2B2621;margin:0 0 4px}
.pdf-meal-rule{border:none;border-top:1px solid #E7DFC9;margin:0 0 10px}
.pdf-options{display:flex;gap:26px}
.pdf-option{flex:1}
.pdf-option-label{font-size:9pt;font-weight:700;color:#B36B5E;text-transform:uppercase;letter-spacing:.04em;margin:0 0 6px}
.pdf-option ul{margin:0;padding-left:16px;font-size:10.5pt;line-height:1.55}
.pdf-section-title{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:13pt;line-height:1.25;color:#2B2621;margin:0 0 12px;padding-bottom:6px;border-bottom:1.5px solid #E7DFC9}
.pdf-supp-section{background:#E4DBC9;border-radius:0;padding:18px 20px;padding-top:12mm}
.pdf-supp-title{color:#C9A46A;border-bottom-color:#C9A46A}
.pdf-reco ul{margin:0;padding-left:16px;font-size:10.5pt;line-height:1.6}
.pdf-supp-row{margin-bottom:10px}
.pdf-supp-name{font-weight:700;font-size:11pt}
.pdf-supp-detail{font-size:9.5pt;color:#8A8377;margin-top:2px}
.pdf-closing{text-align:center;margin:20px 0 4px;padding-top:12mm}
.pdf-closing-rule{width:30%;margin:0 auto 16px;border:none;border-top:1px solid #E7DFC9}
.pdf-closing-quote{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:12pt;line-height:1.5;color:#2B2621}
.pdf-footer{text-align:center;margin-top:24px;page-break-inside:avoid;break-inside:avoid}
.pdf-footer-word{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:15pt;color:#C9A46A;margin:0 0 6px}
.pdf-footer-tagline{font-size:8pt;color:#8A8377;margin:0}`;

function mdBold(text: string): string {
  return (text || "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export default function NutritionPdfGenerator({
  summary, dailyCals, proteinG, carbsG, fatG,
  menu = [], recommendations = [], closingMessage, supplements = [],
}: NutritionPdfGeneratorProps) {
  const [generating, setGenerating] = useState(false);

  const handleDownload = () => {
    setGenerating(true);
    const hasMacros = dailyCals || proteinG || carbsG || fatG;
    const macrosHtml = hasMacros
      ? `<div class="pdf-macros">
          <div><span class="pm-val">${dailyCals ?? "—"}</span><span class="pm-lbl">Kcal</span></div>
          <div><span class="pm-val">${proteinG ?? "—"}g</span><span class="pm-lbl">Proteína</span></div>
          <div><span class="pm-val">${carbsG ?? "—"}g</span><span class="pm-lbl">Carbos</span></div>
          <div><span class="pm-val">${fatG ?? "—"}g</span><span class="pm-lbl">Grasas</span></div>
        </div>` : "";

    const mealsHtml = menu.length > 0
      ? menu.map((m) =>
          `<div class="pdf-meal"><div class="pdf-meal-title">${m.name}</div>
          <hr class="pdf-meal-rule"><div class="pdf-options">${(m.options || []).map((o) =>
            `<div class="pdf-option"><p class="pdf-option-label">${o.label}</p>
            <ul>${(o.items || []).map((it) => `<li>${it}</li>`).join("")}</ul></div>`).join("")}
          </div></div>`).join("")
      : '<p style="font-size:10.5pt;color:#8A8377;">Tu mentor aún no ha cargado el menú de este plan.</p>';

    const recoHtml = recommendations.length > 0
      ? `<div class="pdf-reco pdf-section"><p class="pdf-section-title">Recomendaciones adicionales</p>
        <ul>${recommendations.map((r) => `<li>${r}</li>`).join("")}</ul></div>` : "";

    const suppHtml = supplements.length > 0
      ? `<div class="pdf-section pdf-supp-section">
        <p class="pdf-section-title pdf-supp-title">Esquema de suplementación</p>
        ${supplements.map((s) => `<div class="pdf-supp-row"><div class="pdf-supp-name">${s.name}</div>
          <div class="pdf-supp-detail">${[s.dose, s.timing].filter(Boolean).join(" · ") || s.benefit || ""}</div></div>`).join("")}</div>` : "";

    const closingHtml = closingMessage
      ? `<div class="pdf-closing"><hr class="pdf-closing-rule">
        <p class="pdf-closing-quote">${closingMessage}</p></div>` : "";

    const w = window.open("", "_blank");
    if (!w) { alert("Habilita las ventanas emergentes para descargar el PDF."); setGenerating(false); return; }

    w.document.write(`<!doctype html><html><head><title>Plan nutricional</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,500&family=Jost:wght@400;600&display=swap" rel="stylesheet">
      <style>${PDF_CSS}</style></head><body>
      <div class="pdf-header"><p class="pdf-wordmark">Ephirox</p>
        <p class="pdf-tagline">Redefining limits.</p></div>
      <hr class="pdf-rule"><p class="pdf-title">Plan nutricional</p>
      ${summary ? `<p class="pdf-summary">${mdBold(summary)}</p>` : ""}
      ${macrosHtml}${mealsHtml}${recoHtml}${suppHtml}${closingHtml}
      <div class="pdf-footer"><p class="pdf-footer-word">Ephirox</p>
        <p class="pdf-footer-tagline">Redefining limits.</p></div>
      </body></html>`);
    w.document.close();

    let printed = false;
    const triggerPrint = () => { if (printed) return; printed = true; w.focus(); w.print(); setGenerating(false); };
    if (w.document.fonts?.ready) {
      Promise.race([w.document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 500))])
        .then(triggerPrint).catch(triggerPrint);
    } else { setTimeout(triggerPrint, 150); }
  };

  return (
    <button onClick={handleDownload} disabled={generating}
      className="font-mono"
      style={{ display: "inline-flex", alignItems: "center", gap: 8,
        borderRadius: 0, background: generating ? "var(--eph-surface-2)" : "var(--eph-accent)",
        color: generating ? "var(--eph-muted)" : "var(--eph-ink)",
        border: generating ? "1px solid var(--eph-line)" : "none",
        padding: "12px 24px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em",
        cursor: generating ? "not-allowed" : "pointer", transition: "background-color .15s ease" }}>
      {generating ? "Generando PDF…" : (<><IconFileDownload size={14} /> Descargar plan (PDF)</>)}
    </button>
  );
}