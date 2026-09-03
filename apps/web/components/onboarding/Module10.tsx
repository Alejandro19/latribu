'use client';

import { useEffect, useState } from 'react';
import { extractLabPanel, type ExtractedMarker } from '../../lib/lab-panels-client';
import { OCR_FIELD_MAP } from '../../lib/parse-lab-ocr-text';
import { getWearableEstado, getWearableConnectUrl, syncWearable, disconnectWearable, type Dispositivo, type WearableEstado } from '../../lib/wearable-client';
import SegmentedControl from '../ui/SegmentedControl';
import FloatingField from '../ui/FloatingField';
import FileField from '../ui/FileField';
import { IconActivity, IconClipboardCheck } from '../ui/icons';

// Metadata de nombre/unidad/rango solo para mostrar en el grid — el parseo
// real (OCR + IA) ahora vive enteramente en el backend (ver
// lab-ai-extraction.service.ts). OCR_FIELD_MAP se reusa aquí únicamente como
// diccionario de labels, nunca para parsear texto.
const MARKER_LABELS = new Map(OCR_FIELD_MAP.map((f) => [f.field, f]));

export type Module10Draft = {
  wearable: string | null;
  appleHealth: { hrv: string; fcReposo: string; spo2: string; vo2max: string };
  labSemana: number;
  labFecha: string;
  labMarkers: ExtractedMarker[];
  labFileUrl: string | null;
  labFileName: string | null;
  labSourceFileHash: string | null;
  // Día del ciclo menstrual en la fecha del panel (P6) — solo se pide/usa
  // para clientas Mentoría con ciclo natural, ver props hormonalStatus/etc.
  labDiaCiclo: string;
};

export const EMPTY_MODULE10_DRAFT: Module10Draft = {
  wearable: null,
  appleHealth: { hrv: '', fcReposo: '', spo2: '', vo2max: '' },
  labSemana: 0,
  labFecha: new Date().toISOString().slice(0, 10),
  labMarkers: [],
  labFileUrl: null,
  labFileName: null,
  labSourceFileHash: null,
  labDiaCiclo: '',
};

const NATURAL_CYCLE_STATUSES = ['Ciclo menstrual natural y regular', 'Ciclo menstrual natural pero irregular'];

// Auto-cálculo de P6 desde P2/P3 (ver Matriz_Reglas_Mentoria_BIO360.md,
// pestaña "Fase de Ciclo"): día_actual = (fecha_panel - último_período) mod
// duración_ciclo, 1-indexado. Devuelve null si falta algún dato — el campo
// queda vacío para que la clienta lo complete a mano.
function computeDiaCiclo(labFecha: string, lastPeriodDate: string | null, cycleLengthDays: number | null): number | null {
  if (!lastPeriodDate || !cycleLengthDays || cycleLengthDays <= 0) return null;
  const panel = new Date(labFecha);
  const ultimo = new Date(lastPeriodDate);
  if (Number.isNaN(panel.getTime()) || Number.isNaN(ultimo.getTime())) return null;
  const diffDays = Math.floor((panel.getTime() - ultimo.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return null;
  return (diffDays % cycleLengthDays) + 1;
}

const WEARABLE_OPTIONS = [
  { value: 'Garmin', label: 'Garmin' },
  { value: 'WHOOP', label: 'WHOOP' },
  { value: 'Oura Ring', label: 'Oura Ring' },
  { value: 'Polar Loop', label: 'Polar Loop' },
  { value: 'Apple Watch', label: 'Apple Watch' },
  { value: 'Ninguno', label: 'Ninguno' },
];

const WEARABLE_TO_DISPOSITIVO: Record<string, Dispositivo> = {
  Garmin: 'garmin',
  WHOOP: 'whoop',
  'Oura Ring': 'oura',
  'Polar Loop': 'polar',
};

const SEMANA_OPTIONS = [
  { value: '0', label: 'Semana 0' },
  { value: '6', label: 'Semana 6' },
  { value: '12', label: 'Semana 12' },
];

export type Module10Props = {
  clientId: string;
  draft: Module10Draft;
  onChange: (draft: Module10Draft) => void;
  hormonalStatus?: string | null;
  lastPeriodDate?: string | null;
  cycleLengthDays?: number | null;
};

export function Module10({ clientId, draft, onChange, hormonalStatus, lastPeriodDate, cycleLengthDays }: Module10Props) {
  const isNaturalCycle = !!hormonalStatus && NATURAL_CYCLE_STATUSES.includes(hormonalStatus);
  const [ocrStatus, setOcrStatus] = useState<{ message: string; isError: boolean } | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [wearableEstado, setWearableEstado] = useState<WearableEstado[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const dispositivo = draft.wearable ? WEARABLE_TO_DISPOSITIVO[draft.wearable] : null;
  const estadoActual = dispositivo ? wearableEstado.find((w) => w.dispositivo === dispositivo) : undefined;
  const conectado = !!estadoActual;

  useEffect(() => {
    getWearableEstado(clientId).then(setWearableEstado).catch(() => {});
  }, [clientId]);

  // Sugiere P6 automáticamente al cambiar la fecha del panel — la clienta
  // puede corregirlo a mano después (draft.labDiaCiclo queda editable).
  useEffect(() => {
    if (!isNaturalCycle) return;
    const sugerido = computeDiaCiclo(draft.labFecha, lastPeriodDate ?? null, cycleLengthDays ?? null);
    if (sugerido !== null) onChange({ ...draft, labDiaCiclo: String(sugerido) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.labFecha, isNaturalCycle, lastPeriodDate, cycleLengthDays]);

  async function handleSync() {
    if (!dispositivo) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await syncWearable(clientId, dispositivo);
      if (!result.success) throw new Error(result.error || 'Error al sincronizar.');
      setSyncMsg(`✓ ${result.sincronizados ?? 0} días sincronizados.`);
      const estado = await getWearableEstado(clientId);
      setWearableEstado(estado);
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : 'Error al sincronizar.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!dispositivo) return;
    await disconnectWearable(clientId, dispositivo).catch(() => {});
    const estado = await getWearableEstado(clientId);
    setWearableEstado(estado);
  }

  async function handleLabFile(file: File) {
    if (file.size > 25 * 1024 * 1024) {
      setOcrStatus({ message: 'El archivo excede 25 MB.', isError: true });
      return;
    }
    setOcrBusy(true);
    setOcrStatus({ message: 'Procesando archivo (OCR + IA)…', isError: false });
    try {
      const result = await extractLabPanel(clientId, draft.labSemana, file);
      const detectedCount = result.markers.filter((m) => m.detected).length;
      onChange({
        ...draft,
        labMarkers: result.markers,
        labFileUrl: result.fileUrl,
        labFileName: result.fileName,
        labSourceFileHash: result.sourceFileHash,
      });
      if (detectedCount === 0) {
        setOcrStatus({ message: 'No se detectó ningún biomarcador. Verifica que el archivo sea legible.', isError: true });
      } else {
        const missing = result.markers.length - detectedCount;
        setOcrStatus({
          message: missing > 0
            ? `✓ ${detectedCount} biomarcadores detectados · ${missing} no detectados (el equipo los revisará contra el documento original).`
            : `✓ ${detectedCount} biomarcadores detectados.`,
          isError: false,
        });
      }
    } catch (e) {
      setOcrStatus({ message: e instanceof Error ? e.message : 'Error al procesar el archivo.', isError: true });
    } finally {
      setOcrBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="border p-5" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
        <div className="mb-4 flex items-center gap-2">
          <IconActivity size={16} style={{ color: 'var(--eph-accent)' }} />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--eph-accent)' }}>
            Wearables
          </span>
        </div>
        <p className="m-0 mb-2 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--eph-muted)' }}>Wearables que utilizas</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Wearables que utilizas">
          {WEARABLE_OPTIONS.map((opt) => {
            const selected = draft.wearable === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ ...draft, wearable: opt.value })}
                className="rounded-[999px] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors"
                style={{
                  border: selected ? '1px solid var(--eph-accent)' : '1px solid var(--eph-line-2)',
                  background: selected ? 'var(--eph-accent)' : 'transparent',
                  color: selected ? 'var(--eph-ink)' : 'var(--eph-body)',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {draft.wearable === 'Apple Watch' && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FloatingField id="m10-aw-hrv" label="HRV promedio (Apple Health, ms)" type="number"
              value={draft.appleHealth.hrv} onChange={(v) => onChange({ ...draft, appleHealth: { ...draft.appleHealth, hrv: v } })} />
            <FloatingField id="m10-aw-fc-reposo" label="FC en reposo (Apple Health, bpm)" type="number"
              value={draft.appleHealth.fcReposo} onChange={(v) => onChange({ ...draft, appleHealth: { ...draft.appleHealth, fcReposo: v } })} />
            <FloatingField id="m10-aw-spo2" label="SpO2 promedio (Apple Health, %)" type="number"
              value={draft.appleHealth.spo2} onChange={(v) => onChange({ ...draft, appleHealth: { ...draft.appleHealth, spo2: v } })} />
            <FloatingField id="m10-aw-vo2max" label="VO2 Max estimado (Apple Health)" type="number"
              value={draft.appleHealth.vo2max} onChange={(v) => onChange({ ...draft, appleHealth: { ...draft.appleHealth, vo2max: v } })} />
          </div>
        )}

        {dispositivo && dispositivo !== 'garmin' && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border p-4" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface-2)' }}>
            {conectado ? (
              <>
                <span className="font-body text-sm" style={{ color: 'var(--eph-accent)' }}>
                  ✓ Conectado {estadoActual?.ultimaSync ? `· última sincronización ${new Date(estadoActual.ultimaSync).toLocaleDateString('es-CO')}` : ''}
                </span>
                <button type="button" onClick={handleSync} disabled={syncing}
                  className="rounded-[999px] border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] disabled:opacity-60" style={{ borderColor: 'var(--eph-accent)', color: 'var(--eph-accent)' }}>
                  {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
                </button>
                <button type="button" onClick={handleDisconnect}
                  className="rounded-[999px] border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ borderColor: 'var(--eph-line-2)', color: 'var(--eph-body)' }}>
                  Desconectar
                </button>
              </>
            ) : (
              <a href={getWearableConnectUrl(dispositivo, clientId)}
                className="rounded-[999px] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ background: 'var(--eph-accent)', color: 'var(--eph-ink)' }}>
                Conectar {draft.wearable}
              </a>
            )}
            {syncMsg && <span className="w-full font-body text-xs" style={{ color: 'var(--eph-body)' }}>{syncMsg}</span>}
          </div>
        )}

        {dispositivo === 'garmin' && (
          <p className="mt-4 border border-dashed p-3 font-body text-xs" style={{ borderColor: 'var(--eph-line-2)', color: 'var(--eph-body)' }}>
            La integración con Garmin todavía no está disponible — próximamente.
          </p>
        )}
      </div>

      <div className="border p-5" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
        <div className="mb-1 flex items-center gap-2">
          <IconClipboardCheck size={16} style={{ color: 'var(--eph-accent)' }} />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--eph-accent)' }}>
            Laboratorios clínicos
          </span>
        </div>
        <p className="m-0 mb-4 font-body text-xs" style={{ color: 'var(--eph-body)' }}>Importación automática de biomarcadores vía PDF</p>

        <div className="mb-4">
          <SegmentedControl
            label="¿A qué panel pertenece este laboratorio?"
            options={SEMANA_OPTIONS}
            value={String(draft.labSemana)}
            onChange={(v) => onChange({ ...draft, labSemana: Number(v) })}
          />
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FloatingField id="m10-lab-fecha" label="Fecha del análisis" type="date" value={draft.labFecha}
            onChange={(v) => onChange({ ...draft, labFecha: v })} />
          <FileField id="m10-lab-file" label="Subir PDF o imagen de laboratorio" accept=".pdf,.jpg,.jpeg,.png"
            disabled={ocrBusy} uploading={ocrBusy} fileName={draft.labFileName}
            helper="Extraemos los biomarcadores automáticamente con OCR + IA · PDF, JPG, PNG"
            onFileChange={(file) => { if (file) void handleLabFile(file); }} />
          {isNaturalCycle && (
            <FloatingField id="m10-lab-dia-ciclo" label="Día del ciclo en que te hiciste este panel" type="number"
              value={draft.labDiaCiclo} onChange={(v) => onChange({ ...draft, labDiaCiclo: v })} />
          )}
        </div>

        {ocrStatus && (
          <p role={ocrStatus.isError ? 'alert' : 'status'} className="mb-4 font-body text-sm" style={{ color: ocrStatus.isError ? 'var(--eph-danger)' : 'var(--eph-accent)' }}>
            {ocrStatus.message}
          </p>
        )}

        {draft.labMarkers.length > 0 && (
          <div className="overflow-x-auto border" style={{ borderColor: 'var(--eph-line)' }}>
            <table className="w-full border-collapse font-body text-sm">
              <thead>
                <tr className="border-b text-left font-mono text-[10px] uppercase tracking-[0.1em]" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface-2)', color: 'var(--eph-muted)' }}>
                  <th className="p-2.5">Biomarcador</th>
                  <th className="p-2.5 text-right">Valor</th>
                  <th className="p-2.5">Unidad</th>
                </tr>
              </thead>
              <tbody>
                {draft.labMarkers.map((m) => {
                  const meta = MARKER_LABELS.get(m.marker_id);
                  return (
                    <tr key={m.marker_id} className="border-b last:border-0" style={{ borderColor: 'var(--eph-line)' }}>
                      <td className="p-2.5" style={{ color: 'var(--eph-text)' }}>{meta?.lbl || m.marker_id}</td>
                      <td className="p-2.5 text-right font-medium" style={{ color: m.detected ? 'var(--eph-accent)' : 'var(--eph-muted)' }}>
                        {m.detected ? m.value : 'No detectado'}
                      </td>
                      <td className="p-2.5" style={{ color: 'var(--eph-muted)' }}>{m.detected ? m.unit || meta?.unit : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {draft.labMarkers.length === 0 && (
          <p className="border border-dashed p-6 text-center font-body text-sm" style={{ borderColor: 'var(--eph-line-2)', color: 'var(--eph-body)' }}>
            Los valores aparecerán aquí tras importar el PDF.
          </p>
        )}
      </div>
    </div>
  );
}
