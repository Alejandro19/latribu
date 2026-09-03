'use client';

import type { CortisolTechnique } from '../../lib/cortisol-client';

// "The Rox Ritual" (Prompt 02 §5) reutiliza el sistema de técnicas de
// cortisol existente (decisión confirmada) — son técnicas reales, creadas
// por el admin con isRitual=true, no un sistema paralelo. "Iniciar" abre el
// mismo reproductor (CortisolPlayer) que el resto de las técnicas.
export function RoxRitualSection({ rituals, onStart }: { rituals: CortisolTechnique[]; onStart: (id: string) => void }) {
  if (rituals.length === 0) return null;
  return (
    <section className="border" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)', boxShadow: 'var(--eph-shadow)', padding: 'clamp(26px, 3vw, 38px)' }}>
      <div
        className="font-mono"
        style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--eph-accent)', paddingBottom: 24, borderBottom: '1px solid var(--eph-line)' }}
      >
        The Rox Ritual · calibración de hoy
      </div>
      {rituals.map((r, i) => (
        <div
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-6"
          style={{ padding: '24px 0', borderBottom: '1px solid var(--eph-line)' }}
        >
          <div style={{ display: 'grid', gap: 8 }}>
            <span className="font-display" style={{ fontSize: 26, color: 'var(--eph-text)' }}>{r.title}</span>
            {r.description && <span className="font-body" style={{ fontSize: 16, color: 'var(--eph-body)' }}>{r.description}</span>}
          </div>
          <div className="flex items-center" style={{ gap: 22 }}>
            {r.duration && (
              <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--eph-accent)' }}>{r.duration}</span>
            )}
            <button
              type="button"
              onClick={() => onStart(r.id)}
              className="font-mono transition-colors duration-150 hover:bg-[var(--eph-accent-soft)]"
              style={{
                background: 'transparent', border: '1px solid var(--eph-accent-line)', color: 'var(--eph-accent)',
                padding: '12px 24px', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Iniciar
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
