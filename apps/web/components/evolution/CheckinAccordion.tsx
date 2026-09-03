'use client';

import { useState } from 'react';
import { createCheckin } from '../../lib/evolution-client';
import { showToast } from '../layout/AppShell';
import Accordion from '../ui/Accordion';

const fieldStyle =
  'h-8 w-full border-0 border-b border-[var(--eph-line-2)] rounded-none bg-transparent px-0.5 py-1.5 text-[14.5px] font-semibold text-[var(--eph-text)] outline-none focus-visible:border-[var(--eph-text)] focus-visible:ring-0';
const labelStyle = 'mb-1 block text-xs font-normal text-[var(--eph-muted)]';

export function CheckinAccordion({ clientId, onSaved }: { clientId: string; onSaved?: () => void }) {
  const [sleepHours, setSleepHours] = useState('');
  const [adherencePct, setAdherencePct] = useState('');
  const [stressScore, setStressScore] = useState('');
  const [painFlag, setPainFlag] = useState('');
  const [painNotes, setPainNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await createCheckin(clientId, {
        fecha: new Date().toISOString().slice(0, 10),
        sleep_hours: sleepHours !== '' ? Number(sleepHours) : null,
        adherence_pct: adherencePct !== '' ? Number(adherencePct) : null,
        stress_score: stressScore !== '' ? Number(stressScore) : null,
        pain_flag: painFlag === '' ? null : painFlag === 'Sí',
        pain_notes: painFlag === 'Sí' ? painNotes : null,
      });
      showToast('Check-in guardado.', 'success');
      setSleepHours('');
      setAdherencePct('');
      setStressScore('');
      setPainFlag('');
      setPainNotes('');
      onSaved?.();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Accordion
      items={[
        {
          header: <span className="font-display text-[16px] font-normal text-[var(--eph-text)]">Check-in rápido del mes</span>,
          content: (
            <div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelStyle} htmlFor="ev-sleep">Horas de sueño promedio</label>
                  <input id="ev-sleep" type="number" min={0} step={0.5} className={fieldStyle} value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} />
                </div>
                <div>
                  <label className={labelStyle} htmlFor="ev-adherence">Adherencia al plan (%)</label>
                  <input id="ev-adherence" type="number" min={0} max={100} className={fieldStyle} value={adherencePct} onChange={(e) => setAdherencePct(e.target.value)} />
                </div>
                <div>
                  <label className={labelStyle} htmlFor="ev-stress">Nivel de estrés (1-10)</label>
                  <input id="ev-stress" type="number" min={1} max={10} className={fieldStyle} value={stressScore} onChange={(e) => setStressScore(e.target.value)} />
                </div>
                <div>
                  <label className={labelStyle} htmlFor="ev-pain-flag">¿Dolor o molestias físicas?</label>
                  <select id="ev-pain-flag" className={fieldStyle} value={painFlag} onChange={(e) => setPainFlag(e.target.value)}>
                    <option value="">Selecciona…</option>
                    <option value="Sí">Sí</option>
                    <option value="No">No</option>
                  </select>
                </div>
                {painFlag === 'Sí' && (
                  <div className="sm:col-span-3">
                    <label className={labelStyle} htmlFor="ev-pain-notes">Describe el dolor o molestia</label>
                    <input id="ev-pain-notes" type="text" className={fieldStyle} value={painNotes} onChange={(e) => setPainNotes(e.target.value)} />
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="mt-4 h-10 rounded-[999px] bg-[var(--eph-accent)] px-6 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--eph-ink)] disabled:opacity-60"
              >
                {saving ? 'Guardando…' : 'Guardar check-in'}
              </button>
            </div>
          ),
        },
      ]}
    />
  );
}
