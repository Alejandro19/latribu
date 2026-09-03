'use client';

import { useCallback, useEffect, useState } from 'react';
import { listLabPanels, extractLabPanel, upsertLabPanel, type LabPanel, type ExtractedMarker } from '../../lib/lab-panels-client';
import { OCR_FIELD_MAP } from '../../lib/parse-lab-ocr-text';
import FloatingField from '../ui/FloatingField';
import FileField from '../ui/FileField';

// Mismo diccionario de labels que Module10 (onboarding, semana 0) — reusado
// aquí puramente como metadata de display, nunca para parsear (eso vive en
// el backend, ver lab-ai-extraction.service.ts).
const MARKER_LABELS = new Map(OCR_FIELD_MAP.map((f) => [f.field, f]));

const CHECKPOINTS = [6, 12] as const;
const CHECKPOINT_LABELS: Record<number, string> = { 6: 'Semana 6', 12: 'Semana 12' };

const STATUS_LABELS: Record<string, string> = { pendiente: 'Pendiente', en_revision: 'En revisión', aprobado: 'Aprobado' };

function statusBadgeClasses(status: string): string {
  if (status === 'aprobado') return 'border border-[var(--eph-accent)] text-[var(--eph-accent)]';
  if (status === 'en_revision') return 'border border-[var(--eph-steel)] text-[var(--eph-steel)]';
  return 'border border-[var(--eph-line-2)] text-[var(--eph-muted)]';
}

function CheckpointCard({ clientId, semana, panel, onSaved }: { clientId: string; semana: number; panel: LabPanel | undefined; onSaved: () => void | Promise<void> }) {
  const [markers, setMarkers] = useState<ExtractedMarker[] | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sourceFileHash, setSourceFileHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setStatus({ message: 'Procesando archivo (OCR + IA)…', isError: false });
    try {
      const result = await extractLabPanel(clientId, semana, file);
      setMarkers(result.markers);
      setFileUrl(result.fileUrl);
      setFileName(result.fileName);
      setSourceFileHash(result.sourceFileHash);
      const detected = result.markers.filter((m) => m.detected).length;
      const missing = result.markers.length - detected;
      setStatus({
        message: detected === 0
          ? 'No se detectó ningún biomarcador. Verifica que el archivo sea legible.'
          : missing > 0
            ? `✓ ${detected} biomarcadores detectados · ${missing} no detectados (el equipo los revisará).`
            : `✓ ${detected} biomarcadores detectados.`,
        isError: detected === 0,
      });
    } catch (e) {
      setStatus({ message: e instanceof Error ? e.message : 'Error al procesar el archivo.', isError: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!markers) return;
    setBusy(true);
    try {
      const datos = markers.reduce<Record<string, number>>((acc, m) => {
        if (m.detected && m.value != null) acc[m.marker_id] = m.value;
        return acc;
      }, {});
      await upsertLabPanel(clientId, {
        semana,
        fecha,
        datos,
        fileUrl: fileUrl ?? undefined,
        fileName: fileName ?? undefined,
        sourceFileHash: sourceFileHash ?? undefined,
      });
      setStatus({ message: 'Laboratorio guardado — el equipo lo revisará.', isError: false });
      await onSaved();
    } catch (e) {
      setStatus({ message: e instanceof Error ? e.message : 'Error al guardar.', isError: true });
    } finally {
      setBusy(false);
    }
  }

  const alreadySaved = !!panel;
  const displayMarkers: Array<{ id: string; value: number | null; detected: boolean }> = alreadySaved
    ? Object.entries(panel!.datos || {}).map(([id, value]) => ({ id, value, detected: true }))
    : (markers ?? []).map((m) => ({ id: m.marker_id, value: m.value, detected: m.detected }));

  return (
    <div className="border p-5" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
      <div className="mb-3 flex items-center gap-2">
        <span className="font-display text-[15px]" style={{ color: 'var(--eph-text)' }}>Laboratorio {CHECKPOINT_LABELS[semana]}</span>
        {alreadySaved && (
          <span className={`inline-block rounded-[999px] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${statusBadgeClasses(panel!.status)}`}>
            {STATUS_LABELS[panel!.status] || panel!.status}
          </span>
        )}
      </div>

      {!alreadySaved && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FloatingField id={`lab-checkpoint-${semana}-fecha`} label="Fecha del análisis" type="date" value={fecha} onChange={setFecha} />
          <FileField
            id={`lab-checkpoint-${semana}-file`}
            label="Subir PDF o imagen de laboratorio"
            accept=".pdf,.jpg,.jpeg,.png"
            disabled={busy}
            uploading={busy}
            fileName={fileName}
            helper="Extraemos los biomarcadores automáticamente con OCR + IA · PDF, JPG, PNG"
            onFileChange={(file) => { if (file) void handleFile(file); }}
          />
        </div>
      )}

      {status && (
        <p role={status.isError ? 'alert' : 'status'} className={`mb-3 font-body text-sm ${status.isError ? 'text-[var(--eph-danger)]' : 'text-[var(--eph-accent)]'}`}>
          {status.message}
        </p>
      )}

      {displayMarkers.length > 0 && (
        <div className="mb-4 overflow-x-auto border" style={{ borderColor: 'var(--eph-line)' }}>
          <table className="w-full border-collapse font-body text-sm">
            <thead>
              <tr className="border-b font-mono text-[10px] uppercase tracking-[0.08em]" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface-2)', color: 'var(--eph-muted)' }}>
                <th className="p-2.5">Biomarcador</th>
                <th className="p-2.5 text-right">Valor</th>
                <th className="p-2.5">Unidad</th>
              </tr>
            </thead>
            <tbody>
              {displayMarkers.map((m) => {
                const meta = MARKER_LABELS.get(m.id);
                return (
                  <tr key={m.id} className="border-b border-[var(--eph-line)] last:border-0">
                    <td className="p-2.5 text-[var(--eph-text)]">{meta?.lbl || m.id}</td>
                    <td className="p-2.5 text-right font-semibold" style={{ color: m.detected ? 'var(--eph-accent)' : 'var(--eph-muted)' }}>
                      {m.detected ? m.value : 'No detectado'}
                    </td>
                    <td className="p-2.5 text-[var(--eph-muted)]">{m.detected ? meta?.unit : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!alreadySaved && markers && markers.some((m) => m.detected) && (
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="rounded-none px-5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] disabled:opacity-60"
          style={{ background: 'var(--eph-accent)', color: 'var(--eph-ink)' }}
        >
          {busy ? 'Guardando…' : 'Guardar laboratorio'}
        </button>
      )}
    </div>
  );
}

export function ClientLabCheckpoints({ clientId }: { clientId: string }) {
  const [panels, setPanels] = useState<LabPanel[] | null>(null);

  const load = useCallback(async () => {
    setPanels(await listLabPanels(clientId).catch(() => []));
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  if (panels === null) return null;

  return (
    <section className="rounded-[0] border border-[var(--eph-line)] bg-[var(--eph-surface)] p-6 mb-5">
      <h2 className="mb-1 font-display text-lg" style={{ color: 'var(--eph-text)' }}>Laboratorios de seguimiento</h2>
      <p className="mb-4 font-body text-xs" style={{ color: 'var(--eph-muted)' }}>Carga tus laboratorios de Semana 6 y Semana 12 cuando corresponda.</p>
      <div className="space-y-4">
        {CHECKPOINTS.map((semana) => (
          <CheckpointCard key={semana} clientId={clientId} semana={semana} panel={panels.find((p) => p.semanaNumero === semana)} onSaved={load} />
        ))}
      </div>
    </section>
  );
}
