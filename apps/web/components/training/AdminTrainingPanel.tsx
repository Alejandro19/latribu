'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import {
  type Exercise,
  type ExerciseInput,
  type ExerciseCategory,
  getClientTrainingDays,
  listExercises,
  createExercise,
  updateExercise,
  deleteExercise,
  updateTrainingDays,
} from '../../lib/training-client';
import { listQuotes, getClientAssignedQuoteId, assignQuote } from '../../lib/quotes-client';
import { CATEGORY_LABELS } from './TrainingVisuals';
import { AdminAchievementsPanel } from './AdminAchievementsPanel';
import { showToast } from '../layout/AppShell';
import { IconEdit, IconTrash, IconX } from '../ui/icons';
import { InsightsSection } from '../insights/InsightsSection';

export type AdminTrainingPanelProps = { clientId: string };

// Fila de la tabla maestro-detalle: mientras `mode === 'edit'` los cambios
// solo viven acá (borrador local) — nada se persiste hasta "Guardar todo",
// igual que un asiento en SAP Business One no queda contabilizado hasta
// que se confirma el documento completo.
type RowDraft = {
  key: string;
  id: string | null;
  title: string;
  dayNumber: number;
  category: ExerciseCategory;
  series: string;
  reps: string;
  duration: string;
  restTime: string;
  youtubeUrl: string;
  description: string;
  mode: 'read' | 'edit';
  isNew: boolean;
};

function toRowDraft(ex: Exercise): RowDraft {
  return {
    key: ex.id,
    id: ex.id,
    title: ex.title,
    dayNumber: ex.dayNumber,
    category: ex.category,
    series: ex.series != null ? String(ex.series) : '',
    reps: ex.reps ?? '',
    duration: ex.duration ?? '',
    restTime: ex.restTime ?? '',
    youtubeUrl: ex.youtubeUrl ?? '',
    description: ex.description ?? '',
    mode: 'read',
    isNew: false,
  };
}

function toExerciseInput(row: RowDraft): ExerciseInput {
  return {
    title: row.title.trim(),
    day_number: row.dayNumber,
    category: row.category,
    series: row.series.trim() ? Number(row.series) : null,
    reps: row.reps.trim() || null,
    duration: row.duration.trim() || null,
    rest_time: row.restTime.trim() || null,
    youtube_url: row.youtubeUrl.trim() || null,
    description: row.description.trim() || null,
  };
}

const cardStyle: React.CSSProperties = {
  background: 'var(--eph-surface)', border: '1px solid var(--eph-line)',
  borderRadius: 0, padding: '22px 24px', marginBottom: 20,
};
const cardTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 18, fontWeight: 400, color: 'var(--eph-text)', margin: '0 0 16px',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace', fontSize: 10,
  textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 400, color: 'var(--eph-muted)', marginBottom: 6,
};
const fieldStyle: React.CSSProperties = {
  width: '100%', height: 32, borderRadius: 0, border: 'none', borderBottom: '1px solid var(--eph-line-2)',
  padding: '0 2px 6px', fontSize: 13, background: 'transparent', color: 'var(--eph-text)',
  outline: 'none', boxSizing: 'border-box',
};
const textareaStyle: React.CSSProperties = {
  width: '100%', borderRadius: 0, border: '1px solid var(--eph-line)',
  padding: 10, fontSize: 14.5, fontWeight: 400, background: 'var(--eph-surface)', color: 'var(--eph-text)',
  outline: 'none', boxSizing: 'border-box', minHeight: 72, resize: 'vertical', fontFamily: 'inherit',
};
const thStyle: React.CSSProperties = {
  textAlign: 'left', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace', fontSize: 10, fontWeight: 400, color: 'var(--eph-muted)',
  textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 10px 10px', whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = {
  padding: '8px 10px', fontSize: 13, color: 'var(--eph-text)', verticalAlign: 'middle',
  borderTop: '1px solid var(--eph-line)',
};

function iconButtonStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 0, border: '1px solid var(--eph-line-2)',
    background: 'transparent', color, cursor: 'pointer', fontSize: 14, lineHeight: 1,
  };
}

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6];
const TRAINING_DAYS_OPTIONS = [3, 4, 5, 6];
const CATEGORY_OPTIONS: ExerciseCategory[] = ['warmup', 'strength', 'core', 'cardio', 'stretching'];

type RowViewProps = {
  row: RowDraft;
  onChange: (patch: Partial<RowDraft>) => void;
  onEdit: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

function RowView({ row, onChange, onEdit, onConfirm, onCancel, onDelete }: RowViewProps) {
  if (row.mode === 'read') {
    return (
      <tr>
        <td style={tdStyle}>Día {row.dayNumber}</td>
        <td style={tdStyle}>{row.title}</td>
        <td style={tdStyle}>{CATEGORY_LABELS[row.category]}</td>
        <td style={tdStyle}>{row.series || '—'}</td>
        <td style={tdStyle}>{row.reps || '—'}</td>
        <td style={tdStyle}>{row.duration || '—'}</td>
        <td style={tdStyle}>{row.restTime || '—'}</td>
        <td style={tdStyle}>
          {row.youtubeUrl ? (
            <a href={row.youtubeUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--eph-accent)' }}>
              Ver video
            </a>
          ) : (
            '—'
          )}
        </td>
        <td
          style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={row.description || undefined}
        >
          {row.description || '—'}
        </td>
        <td style={tdStyle}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" aria-label="Editar" onClick={onEdit} style={iconButtonStyle('var(--eph-muted)')}>
              <IconEdit size={13} />
            </button>
            <button type="button" aria-label="Eliminar" onClick={onDelete} style={iconButtonStyle('var(--eph-danger)')}>
              <IconTrash size={13} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ background: 'var(--eph-surface-2)' }}>
      <td style={tdStyle}>
        <select style={fieldStyle} value={row.dayNumber} onChange={(e) => onChange({ dayNumber: Number(e.target.value) })}>
          {DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              Día {d}
            </option>
          ))}
        </select>
      </td>
      <td style={tdStyle}>
        <input
          autoFocus
          style={fieldStyle}
          value={row.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Título del ejercicio"
        />
      </td>
      <td style={tdStyle}>
        <select style={fieldStyle} value={row.category} onChange={(e) => onChange({ category: e.target.value as ExerciseCategory })}>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </td>
      <td style={tdStyle}>
        <input type="number" style={fieldStyle} value={row.series} onChange={(e) => onChange({ series: e.target.value })} />
      </td>
      <td style={tdStyle}>
        <input style={fieldStyle} value={row.reps} onChange={(e) => onChange({ reps: e.target.value })} />
      </td>
      <td style={tdStyle}>
        <input style={fieldStyle} value={row.duration} onChange={(e) => onChange({ duration: e.target.value })} placeholder="mm:ss" />
      </td>
      <td style={tdStyle}>
        <input style={fieldStyle} value={row.restTime} onChange={(e) => onChange({ restTime: e.target.value })} placeholder="mm:ss" />
      </td>
      <td style={tdStyle}>
        <input
          style={fieldStyle}
          value={row.youtubeUrl}
          onChange={(e) => onChange({ youtubeUrl: e.target.value })}
          placeholder="https://youtube.com/watch?v=..."
        />
      </td>
      <td style={tdStyle}>
        <input
          style={fieldStyle}
          value={row.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Describe el ejercicio"
        />
      </td>
      <td style={tdStyle}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" aria-label="Guardar fila" onClick={onConfirm} style={iconButtonStyle('var(--eph-accent)')}>
            ✓
          </button>
          <button type="button" aria-label="Cancelar" onClick={onCancel} style={iconButtonStyle('var(--eph-danger)')}>
            <IconX size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

async function fetchTrainingAdminBundle(clientId: string) {
  const [trainingDays, exercises, quotes, assignedQuoteId] = await Promise.all([
    getClientTrainingDays(clientId),
    listExercises(clientId),
    listQuotes(),
    getClientAssignedQuoteId(clientId),
  ]);
  return { trainingDays, exercises, quotes, assignedQuoteId };
}

export function AdminTrainingPanel({ clientId }: AdminTrainingPanelProps) {
  const { data, error, isLoading: loading, mutate } = useSWR(['training-admin-bundle', clientId], () =>
    fetchTrainingAdminBundle(clientId),
  );
  const [saving, setSaving] = useState(false);

  const [trainingDaysDraft, setTrainingDaysDraft] = useState(0);
  const [assignedQuoteDraft, setAssignedQuoteDraft] = useState('');

  const [rows, setRows] = useState<RowDraft[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const rowBeforeEdit = useRef<Record<string, RowDraft>>({});
  const draftCounter = useRef(0);

  useEffect(() => {
    if (!data) return;
    setTrainingDaysDraft(data.trainingDays);
    setAssignedQuoteDraft(data.assignedQuoteId ?? '');
    setRows(data.exercises.map(toRowDraft));
    setPendingDeleteIds([]);
    rowBeforeEdit.current = {};
  }, [data]);

  const trainingDaysServer = data?.trainingDays ?? 0;
  const assignedQuoteServer = data?.assignedQuoteId ?? null;
  const quotes = data?.quotes ?? [];

  async function refetch() {
    await mutate();
  }

  function handleAddRow() {
    draftCounter.current += 1;
    const key = `new-${draftCounter.current}`;
    setRows((prev) => [
      ...prev,
      {
        key,
        id: null,
        title: '',
        dayNumber: 1,
        category: 'strength',
        series: '',
        reps: '',
        duration: '',
        restTime: '',
        youtubeUrl: '',
        description: '',
        mode: 'edit',
        isNew: true,
      },
    ]);
  }

  function updateRow(key: string, patch: Partial<RowDraft>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function startEdit(key: string) {
    const row = rows.find((r) => r.key === key);
    if (row) rowBeforeEdit.current[key] = row;
    updateRow(key, { mode: 'edit' });
  }

  function confirmRow(key: string) {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    if (!row.title.trim()) {
      showToast('El título del ejercicio es obligatorio.', 'error');
      return;
    }
    updateRow(key, { mode: 'read' });
    delete rowBeforeEdit.current[key];
  }

  function cancelRow(key: string) {
    const row = rows.find((r) => r.key === key);
    if (row?.isNew) {
      setRows((prev) => prev.filter((r) => r.key !== key));
      delete rowBeforeEdit.current[key];
      return;
    }
    const before = rowBeforeEdit.current[key];
    if (before) setRows((prev) => prev.map((r) => (r.key === key ? { ...before, mode: 'read' } : r)));
    else updateRow(key, { mode: 'read' });
    delete rowBeforeEdit.current[key];
  }

  function requestDelete(key: string) {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    if (!window.confirm(`¿Eliminar "${row.title}" de la rutina?`)) return;
    if (row.id) setPendingDeleteIds((prev) => [...prev, row.id!]);
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  async function handleSaveAll() {
    if (rows.some((r) => r.mode === 'edit')) {
      showToast('Termina de guardar o cancelar las filas en edición antes de guardar todo.', 'error');
      return;
    }
    setSaving(true);
    try {
      const ops: Promise<unknown>[] = [];
      if (trainingDaysDraft !== trainingDaysServer) ops.push(updateTrainingDays(clientId, trainingDaysDraft));
      if (assignedQuoteDraft !== (assignedQuoteServer ?? '')) ops.push(assignQuote(clientId, assignedQuoteDraft || null));
      for (const id of pendingDeleteIds) ops.push(deleteExercise(clientId, id));
      for (const row of rows) {
        const input = toExerciseInput(row);
        ops.push(row.isNew ? createExercise(clientId, input) : updateExercise(clientId, row.id as string, input));
      }
      await Promise.all(ops);
      await refetch();
      showToast('Cambios guardados.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
      await refetch();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: 'var(--eph-muted)' }}>Cargando…</p>;
  if (error) return <p style={{ color: 'var(--eph-danger)' }}>{(error as Error).message}</p>;

  return (
    <div>
      <InsightsSection clientId={clientId} moduleKey="entrenamiento" />
      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>Configuración del cliente</h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={labelStyle} htmlFor="training-days">
              Días de entrenamiento por semana
            </label>
            <select
              id="training-days"
              style={fieldStyle}
              value={trainingDaysDraft}
              onChange={(e) => setTrainingDaysDraft(Number(e.target.value))}
            >
              {!TRAINING_DAYS_OPTIONS.includes(trainingDaysDraft) && (
                <option value={trainingDaysDraft}>
                  {trainingDaysDraft ? `${trainingDaysDraft} días / semana` : 'Sin definir'}
                </option>
              )}
              {TRAINING_DAYS_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} días / semana
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <label style={labelStyle} htmlFor="assigned-quote">
              Frase asignada a este cliente
            </label>
            <select
              id="assigned-quote"
              style={fieldStyle}
              value={assignedQuoteDraft}
              onChange={(e) => setAssignedQuoteDraft(e.target.value)}
            >
              <option value="">Aleatoria del pool general</option>
              {quotes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.quote.length > 60 ? `${q.quote.slice(0, 60)}…` : q.quote}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ ...cardTitleStyle, margin: 0 }}>Rutina de ejercicios</h3>
          <button
            type="button"
            onClick={handleAddRow}
            style={{
              height: 36, padding: '0 18px', borderRadius: 0, border: 'none',
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              background: 'var(--eph-accent)', color: 'var(--eph-ink)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', cursor: 'pointer',
            }}
          >
            + Agregar ejercicio
          </button>
        </div>

        {rows.length === 0 ? (
          <p style={{ color: 'var(--eph-muted)', fontSize: 13 }}>Sin ejercicios asignados todavía.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Día</th>
                  <th style={thStyle}>Título</th>
                  <th style={thStyle}>Categoría</th>
                  <th style={thStyle}>Series</th>
                  <th style={thStyle}>Repeticiones</th>
                  <th style={thStyle}>Duración</th>
                  <th style={thStyle}>Descanso</th>
                  <th style={thStyle}>Video (YouTube)</th>
                  <th style={thStyle}>Descripción</th>
                  <th style={thStyle}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <RowView
                    key={row.key}
                    row={row}
                    onChange={(patch) => updateRow(row.key, patch)}
                    onEdit={() => startEdit(row.key)}
                    onConfirm={() => confirmRow(row.key)}
                    onCancel={() => cancelRow(row.key)}
                    onDelete={() => requestDelete(row.key)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminAchievementsPanel clientId={clientId} />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          disabled={saving}
          onClick={handleSaveAll}
          style={{
            height: 44, padding: '0 32px', borderRadius: 0, border: 'none',
            fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
            background: 'var(--eph-accent)', color: 'var(--eph-ink)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em',
            cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Guardando…' : 'Guardar todo'}
        </button>
      </div>
    </div>
  );
}
