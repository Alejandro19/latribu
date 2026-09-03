'use client';

import { useState } from 'react';
import { approveLabPanel, type LabPanel } from '../../lib/lab-panels-client';
import { OCR_FIELD_MAP } from '../../lib/parse-lab-ocr-text';
import { showToast } from '../layout/AppShell';

const MARKER_LABELS = new Map(OCR_FIELD_MAP.map((f) => [f.field, f]));

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
};

function statusBadgeStyle(status: string): React.CSSProperties {
  const map: Record<string, string> = {
    pendiente: 'var(--eph-faint)',
    en_revision: 'var(--eph-steel)',
    aprobado: 'var(--eph-accent)',
  };
  const color = map[status] || map.pendiente;
  return {
    display: 'inline-block', padding: '3px 12px', borderRadius: 999,
    fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em',
    border: `1px solid ${color}`, color,
  };
}

const labelCellStyle: React.CSSProperties = {
  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace', fontSize: 10,
  textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--eph-muted)',
};

const inputStyle: React.CSSProperties = {
  width: 100, height: 30, borderRadius: 0, border: 'none', borderBottom: '1px solid var(--eph-line-2)',
  padding: '0 2px 4px', fontSize: 14, fontWeight: 400, background: 'transparent', color: 'var(--eph-text)',
  outline: 'none', textAlign: 'right', boxSizing: 'border-box',
};

export function AdminLabPanelReview({
  clientId,
  semana,
  panel,
  onApproved,
}: {
  clientId: string;
  semana: number;
  panel: LabPanel | undefined;
  onApproved: () => void | Promise<void>;
}) {
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [approving, setApproving] = useState(false);

  if (!panel) {
    return (
      <p className="font-body" style={{ fontSize: 13, color: 'var(--eph-muted)' }}>
        El cliente todavía no cargó el laboratorio de Semana {semana}.
      </p>
    );
  }

  const datos = (panel.datos || {}) as Record<string, number>;
  const markerIds = Object.keys(datos);

  function valueFor(id: string): string {
    return edited[id] !== undefined ? edited[id] : String(datos[id]);
  }

  async function handleApprove() {
    setApproving(true);
    try {
      let changed = false;
      const overrides: Record<string, number> = {};
      for (const id of markerIds) {
        const raw = valueFor(id);
        const v = Number(raw);
        if (Number.isNaN(v)) continue;
        overrides[id] = v;
        if (v !== datos[id]) changed = true;
      }
      await approveLabPanel(clientId, semana, changed ? overrides : undefined);
      setEdited({});
      showToast(`Laboratorio de Semana ${semana} aprobado.`, 'success');
      await onApproved();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error al aprobar.', 'error');
    } finally {
      setApproving(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={statusBadgeStyle(panel.status)}>{STATUS_LABELS[panel.status] || panel.status}</span>
        {panel.fecha && <span className="font-body" style={{ fontSize: 12, color: 'var(--eph-muted)' }}>Fecha del análisis: {panel.fecha}</span>}
        {panel.fileUrl && (
          <a href={panel.fileUrl} target="_blank" rel="noreferrer" className="font-mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--eph-accent)', textDecoration: 'underline' }}>
            Ver PDF original
          </a>
        )}
      </div>

      {markerIds.length === 0 ? (
        <p className="font-body" style={{ fontSize: 13, color: 'var(--eph-muted)' }}>Este panel no tiene marcadores guardados.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--eph-line)', borderRadius: 0, marginBottom: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--eph-surface-2)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', ...labelCellStyle }}>Marcador</th>
                <th style={{ padding: '8px 12px', ...labelCellStyle, textAlign: 'right' }}>Valor</th>
                <th style={{ padding: '8px 12px', ...labelCellStyle }}>Unidad</th>
              </tr>
            </thead>
            <tbody>
              {markerIds.map((id) => {
                const meta = MARKER_LABELS.get(id);
                return (
                  <tr key={id} style={{ borderTop: '1px solid var(--eph-line)' }}>
                    <td className="font-body" style={{ padding: '8px 12px', color: 'var(--eph-text)' }}>{meta?.lbl || id}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <input
                        value={valueFor(id)}
                        onChange={(e) => setEdited((prev) => ({ ...prev, [id]: e.target.value }))}
                        disabled={panel.status === 'aprobado'}
                        style={inputStyle}
                      />
                    </td>
                    <td className="font-body" style={{ padding: '8px 12px', color: 'var(--eph-muted)' }}>{meta?.unit || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {panel.status !== 'aprobado' && (
        <button
          type="button"
          onClick={handleApprove}
          disabled={approving}
          className="font-mono"
          style={{
            padding: '8px 18px', borderRadius: 0, border: '1px solid var(--eph-accent)',
            background: 'transparent', color: 'var(--eph-accent)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em',
            cursor: approving ? 'not-allowed' : 'pointer', opacity: approving ? 0.6 : 1,
          }}
        >
          {approving ? 'Aprobando…' : 'Aprobar laboratorio'}
        </button>
      )}
    </div>
  );
}
