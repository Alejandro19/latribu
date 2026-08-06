'use client';

import { useEffect, useState } from 'react';
import { callOcr } from '../../lib/onboarding-client';
import { parseLabOcrText, OCR_FIELD_MAP } from '../../lib/parse-lab-ocr-text';
import { getWearableEstado, getWearableConnectUrl, syncWearable, disconnectWearable, type Dispositivo, type WearableEstado } from '../../lib/wearable-client';
import SegmentedControl from '../ui/SegmentedControl';
import FloatingField from '../ui/FloatingField';
import FileField from '../ui/FileField';

export type Module10Draft = {
  wearable: string | null;
  appleHealth: { hrv: string; fcReposo: string; spo2: string; vo2max: string };
  labSemana: number;
  labFecha: string;
  labDatos: Record<string, string>;
  labFileName: string | null;
};

export const EMPTY_MODULE10_DRAFT: Module10Draft = {
  wearable: null,
  appleHealth: { hrv: '', fcReposo: '', spo2: '', vo2max: '' },
  labSemana: 0,
  labFecha: new Date().toISOString().slice(0, 10),
  labDatos: {},
  labFileName: null,
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

const LAB_BIOMARKER_COUNT = OCR_FIELD_MAP.length;

export type Module10Props = {
  clientId: string;
  draft: Module10Draft;
  onChange: (draft: Module10Draft) => void;
};

export function Module10({ clientId, draft, onChange }: Module10Props) {
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
    setOcrStatus({ message: 'Procesando archivo…', isError: false });
    try {
      const base64 = await fileToBase64(file);
      const { text } = await callOcr(clientId, base64);
      if (!text.trim()) throw new Error('No se pudo extraer texto. Exporta el reporte como JPG/PNG e intenta de nuevo.');
      const parsed = parseLabOcrText(text);
      const count = Object.keys(parsed).length;
      if (count === 0) throw new Error('No se detectaron biomarcadores. Verifica que el PDF sea legible.');

      const labDatos: Record<string, string> = {};
      Object.entries(parsed).forEach(([k, v]) => { labDatos[k] = String(v); });
      onChange({ ...draft, labDatos, labFileName: file.name });
      setOcrStatus({ message: `✓ ${count} biomarcadores detectados.`, isError: false });
    } catch (e) {
      setOcrStatus({ message: e instanceof Error ? e.message : 'Error al procesar el archivo.', isError: true });
    } finally {
      setOcrBusy(false);
    }
  }

  const groups = OCR_FIELD_MAP.reduce<Record<string, typeof OCR_FIELD_MAP>>((acc, f) => {
    if (draft.labDatos[f.field] === undefined) return acc;
    // Agrupar por la primera palabra del comentario de sección original no
    // aplica en runtime — se listan en el orden del mapa, sin subtítulos.
    (acc.__all__ ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--line)] p-5">
        <h3 className="m-0 mb-4 text-[15px] font-bold text-[var(--ink)]">Wearables</h3>
        <SegmentedControl
          label="Wearables que utilizas"
          options={WEARABLE_OPTIONS}
          value={draft.wearable ?? ''}
          onChange={(v) => onChange({ ...draft, wearable: v })}
        />

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
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--cream)] p-4">
            {conectado ? (
              <>
                <span className="text-sm text-[var(--sage)]">
                  ✓ Conectado {estadoActual?.ultimaSync ? `· última sincronización ${new Date(estadoActual.ultimaSync).toLocaleDateString('es-CO')}` : ''}
                </span>
                <button type="button" onClick={handleSync} disabled={syncing}
                  className="rounded-full border border-[var(--sage)] px-4 py-1.5 text-xs font-semibold text-[var(--sage)] disabled:opacity-60">
                  {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
                </button>
                <button type="button" onClick={handleDisconnect}
                  className="rounded-full border border-[var(--line)] px-4 py-1.5 text-xs font-semibold text-[var(--ink-soft)]">
                  Desconectar
                </button>
              </>
            ) : (
              <a href={getWearableConnectUrl(dispositivo, clientId)}
                className="rounded-full bg-[var(--gold)] px-4 py-2 text-xs font-semibold text-white">
                Conectar {draft.wearable}
              </a>
            )}
            {syncMsg && <span className="w-full text-xs text-[var(--ink-soft)]">{syncMsg}</span>}
          </div>
        )}

        {dispositivo === 'garmin' && (
          <p className="mt-4 rounded-xl border border-dashed border-[var(--line)] p-3 text-xs text-[var(--ink-soft)]">
            La integración con Garmin todavía no está disponible — próximamente.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--line)] p-5">
        <h3 className="m-0 mb-1 text-[15px] font-bold text-[var(--ink)]">Laboratorios Clínicos</h3>
        <p className="m-0 mb-4 text-xs text-[var(--ink-soft)]">Importación automática de biomarcadores vía PDF</p>

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
            disabled={ocrBusy} fileName={draft.labFileName}
            helper={`Extraemos ${LAB_BIOMARKER_COUNT} biomarcadores automáticamente · PDF, JPG, PNG`}
            onFileChange={(file) => { if (file) void handleLabFile(file); }} />
        </div>

        {ocrStatus && (
          <p role={ocrStatus.isError ? 'alert' : 'status'} className={`mb-4 text-sm ${ocrStatus.isError ? 'text-[var(--danger)]' : 'text-[var(--sage)]'}`}>
            {ocrStatus.message}
          </p>
        )}

        {groups.__all__ && groups.__all__.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--cream)] text-left text-xs text-[var(--ink-soft)]">
                  <th className="p-2.5">Biomarcador</th>
                  <th className="p-2.5 text-right">Valor</th>
                  <th className="p-2.5">Unidad</th>
                  <th className="p-2.5">Rango óptimo</th>
                </tr>
              </thead>
              <tbody>
                {groups.__all__.map((f) => (
                  <tr key={f.field} className="border-b border-[var(--line)] last:border-0">
                    <td className="p-2.5 text-[var(--ink)]">{f.lbl}</td>
                    <td className="p-2.5 text-right font-semibold text-[var(--sage)]">{draft.labDatos[f.field]}</td>
                    <td className="p-2.5 text-[var(--ink-soft)]">{f.unit}</td>
                    <td className="p-2.5 text-[var(--ink-soft)]">{f.opt[0]}–{f.opt[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(!groups.__all__ || groups.__all__.length === 0) && (
          <p className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center text-sm text-[var(--ink-soft)]">
            Los valores aparecerán aquí tras importar el PDF.
          </p>
        )}
      </div>
    </div>
  );
}
