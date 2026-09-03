"use client";

import { useRef, useState, useCallback } from "react";
import { Check, FileText, ShieldCheck, Lock, ChevronDown } from "lucide-react";
import {
  DATA_POLICY_VERSION,
  TERMS_VERSION,
  DATOS_CONTENT,
  TERMINOS_CONTENT,
} from "./legal-content";

/**
 * Paso de aceptación legal — La Tribu
 *
 * Dos usos: (1) gate obligatorio de pantalla completa en AppShell.tsx,
 * bloqueando toda la app la primera vez que un cliente entra y todavía no
 * tiene ninguna aceptación registrada (el alta de cuenta la hace un admin,
 * no hay auto-registro); (2) reaceptación voluntaria desde Configuración de
 * cuenta (PanelConfiguracion.jsx) cuando el cliente quiere revisar o
 * actualizar su autorización.
 *
 * El texto completo de cada documento vive en ./legal-content.js y se
 * renderiza AQUÍ, dentro del mismo panel con scroll — no hay redirección
 * a otra página. Cada documento debe desplazarse hasta el final antes de
 * habilitar su casilla, igual que un instalador de software.
 *
 * onComplete(payload) recibe lo que el backend debe guardar como evidencia
 * de aceptación: versión de cada documento, marca de tiempo y los tres
 * consentimientos.
 */

function Blocks({ blocks }) {
  return blocks.map((b, i) => {
    if (b.p) {
      return (
        <p key={i} className="text-[13.5px] leading-relaxed mb-2.5" style={{ color: "var(--eph-body)" }}>
          {b.p}
        </p>
      );
    }
    if (b.note) {
      return (
        <p key={i} className="text-[12.5px] italic leading-relaxed mb-2.5" style={{ color: "var(--eph-faint)" }}>
          {b.note}
        </p>
      );
    }
    if (b.ul) {
      return (
        <ul key={i} className="mb-2.5 space-y-1.5">
          {b.ul.map((item, j) => (
            <li key={j} className="text-[13.5px] leading-relaxed pl-4 relative" style={{ color: "var(--eph-body)" }}>
              <span className="absolute left-0" style={{ color: "var(--eph-accent)" }}>•</span>
              {item}
            </li>
          ))}
        </ul>
      );
    }
    return null;
  });
}

const PANEL_BG = "var(--eph-surface-2)";

function ScrollableDoc({ items, onReachEnd, scrolled }) {
  const ref = useRef(null);
  const handleScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) onReachEnd();
  }, [onReachEnd]);

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={handleScroll}
        className="h-[24rem] overflow-y-auto pr-3 border-t"
        style={{ borderColor: "var(--eph-line)" }}
      >
        {items.map((it, i) => (
          <div key={i} className="pt-5 pb-1">
            <h4 className="font-display font-normal text-[17px] mb-1.5" style={{ color: "var(--eph-text)" }}>{it.h}</h4>
            <Blocks blocks={it.blocks} />
          </div>
        ))}
        {/* Reserved space so the fade never overlaps real text */}
        <div className="h-11" />
      </div>
      {!scrolled && (
        <div
          className="absolute bottom-0 left-0 right-3 h-11 pointer-events-none flex items-end justify-center pb-1.5"
          style={{ background: `linear-gradient(to bottom, transparent, ${PANEL_BG} 70%)` }}
        >
          <span className="font-mono flex items-center gap-1 text-[10px] uppercase tracking-wide" style={{ color: "var(--eph-faint)" }}>
            <ChevronDown size={13} /> desplázate para continuar
          </span>
        </div>
      )}
    </div>
  );
}

function Consent({ label, checked, enabled, onToggle, locked }) {
  return (
    <button
      type="button"
      onClick={enabled ? onToggle : undefined}
      disabled={!enabled}
      className="w-full flex items-start gap-3 py-3 text-left transition-opacity"
      style={{ opacity: enabled ? 1 : 0.45, cursor: enabled ? "pointer" : "not-allowed" }}
    >
      <span
        className="mt-0.5 flex-shrink-0 flex items-center justify-center border transition-colors"
        style={{
          width: 18, height: 18, borderRadius: 0,
          borderColor: checked ? "var(--eph-accent)" : "var(--eph-line-2)",
          background: checked ? "var(--eph-accent)" : "transparent",
        }}
      >
        {checked && <Check size={12} color="var(--eph-ink)" strokeWidth={3} />}
        {!checked && locked && <Lock size={9} color="var(--eph-line-2)" />}
      </span>
      <span className="text-[13.5px] leading-snug" style={{ color: "var(--eph-text)" }}>{label}</span>
    </button>
  );
}

export default function AceptacionRegistro({ onComplete = () => {} }) {
  const [tab, setTab] = useState("datos");
  const [scrolled, setScrolled] = useState({ datos: false, terminos: false });
  const [accepted, setAccepted] = useState({ datos: false, terminos: false, sensible: false });
  const [done, setDone] = useState(false);

  const markScrolled = (k) => setScrolled((s) => (s[k] ? s : { ...s, [k]: true }));
  const toggle = (k) => setAccepted((a) => ({ ...a, [k]: !a[k] }));

  const allAccepted = accepted.datos && accepted.terminos && accepted.sensible;

  const handleContinue = () => {
    if (!allAccepted) return;
    setDone(true);
    onComplete({
      dataPolicyVersion: DATA_POLICY_VERSION,
      termsVersion: TERMS_VERSION,
      acceptedAt: new Date().toISOString(),
      sensitiveDataConsent: true,
    });
  };

  if (done) {
    return (
      <div className="min-h-[560px] flex items-center justify-center" style={{ background: "var(--eph-bg)" }}>
        <div className="text-center px-8">
          <div
            className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{ border: "1.5px solid var(--eph-accent)" }}
          >
            <Check size={22} color="var(--eph-accent)" strokeWidth={2.5} />
          </div>
          <h2 className="font-display font-normal text-[24px] mb-2" style={{ color: "var(--eph-text)" }}>Todo listo</h2>
          <p className="text-[13.5px]" style={{ color: "var(--eph-muted)" }}>
            Registramos tu aceptación con fecha y versión de cada documento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[560px] flex items-center justify-center px-4 py-10" style={{ background: "var(--eph-bg)" }}>
      <div
        className="w-full max-w-[500px] border p-7 sm:p-8"
        style={{ borderRadius: 0, borderColor: "var(--eph-line)", background: "var(--eph-surface)" }}
      >
        <div className="flex items-center gap-2 mb-5">
          <span className="font-display text-[15px] tracking-[0.18em] uppercase" style={{ color: "var(--eph-accent)" }}>Ephirox</span>
        </div>

        <h1 className="font-display font-normal text-[24px] mb-6 leading-snug" style={{ color: "var(--eph-text)" }}>Protección de datos y condiciones de uso</h1>

        <div className="flex gap-2 mb-4">
          {[
            { k: "datos", label: "Datos personales", Icon: ShieldCheck },
            { k: "terminos", label: "Términos de uso", Icon: FileText },
          ].map(({ k, label, Icon }) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className="font-mono flex items-center gap-1.5 px-3.5 py-2 text-[10px] uppercase tracking-wide border transition-colors"
              style={
                tab === k
                  ? { borderRadius: 0, background: "var(--eph-accent)", borderColor: "var(--eph-accent)", color: "var(--eph-ink)" }
                  : { borderRadius: 0, background: "transparent", borderColor: "var(--eph-line-2)", color: "var(--eph-body)" }
              }
            >
              <Icon size={13} />
              {label}
              {scrolled[k] && <Check size={12} className="ml-0.5" />}
            </button>
          ))}
        </div>

        <div className="border p-5" style={{ borderRadius: 0, borderColor: "var(--eph-line)", background: PANEL_BG }}>
          {tab === "datos" ? (
            <ScrollableDoc items={DATOS_CONTENT} scrolled={scrolled.datos} onReachEnd={() => markScrolled("datos")} />
          ) : (
            <ScrollableDoc items={TERMINOS_CONTENT} scrolled={scrolled.terminos} onReachEnd={() => markScrolled("terminos")} />
          )}
        </div>

        <div className="mt-2 divide-y" style={{ borderColor: "var(--eph-line)" }}>
          <Consent
            label="He leído y acepto la Política de Tratamiento de Datos Personales."
            checked={accepted.datos}
            enabled={scrolled.datos}
            locked={!scrolled.datos}
            onToggle={() => toggle("datos")}
          />
          <Consent
            label="He leído y acepto los Términos y Condiciones de Uso."
            checked={accepted.terminos}
            enabled={scrolled.terminos}
            locked={!scrolled.terminos}
            onToggle={() => toggle("terminos")}
          />
          <Consent
            label="Autorizo el tratamiento de mis datos sensibles de salud (mediciones, sueño, recuperación) para los fines descritos. Entiendo que es voluntario."
            checked={accepted.sensible}
            enabled={true}
            locked={false}
            onToggle={() => toggle("sensible")}
          />
        </div>

        <button
          type="button"
          disabled={!allAccepted}
          onClick={handleContinue}
          className="font-mono w-full mt-5 text-[11px] uppercase tracking-[0.1em] transition-colors"
          style={{
            height: 48, borderRadius: 0,
            background: allAccepted ? "var(--eph-accent)" : "transparent",
            color: allAccepted ? "var(--eph-ink)" : "var(--eph-muted)",
            border: allAccepted ? "1px solid var(--eph-accent)" : "1px solid var(--eph-line-2)",
            cursor: allAccepted ? "pointer" : "not-allowed",
          }}
        >
          Continuar
        </button>

        <p className="text-[11px] text-center mt-3" style={{ color: "var(--eph-muted)" }}>
          {DATA_POLICY_VERSION} · {TERMS_VERSION}
        </p>
      </div>
    </div>
  );
}
