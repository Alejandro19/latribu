'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  type AdminPhrase,
  listPhrases,
  createPhrase,
  updatePhrase,
  deletePhrase,
  drawPreviewPhrase,
} from '../../lib/phrases-client';
import { IconShuffle } from '../ui/icons';

const CONTEXT_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'confirmacion', label: 'Confirmación' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'ambas', label: 'Ambas' },
];

const cardStyle: React.CSSProperties = {
  background: 'var(--eph-surface)', border: '1px solid var(--eph-line)',
  borderRadius: '0', padding: '22px 24px', marginBottom: 20,
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
  padding: '0 2px 6px', fontSize: 15, fontWeight: 400, background: 'transparent', color: 'var(--eph-text)',
  outline: 'none', boxSizing: 'border-box',
};
const selectStyle: React.CSSProperties = { ...fieldStyle, height: 36 };
const textareaStyle: React.CSSProperties = {
  width: '100%', borderRadius: 0, border: '1px solid var(--eph-line)',
  padding: 10, fontSize: 15, fontWeight: 400, background: 'var(--eph-surface-2)', color: 'var(--eph-text)',
  outline: 'none', boxSizing: 'border-box', minHeight: 60, resize: 'vertical', fontFamily: 'inherit',
};
const draftCardStyle: React.CSSProperties = {
  background: 'var(--eph-surface-2)', border: '1px solid var(--eph-line)', borderRadius: 0, padding: 16, marginBottom: 10,
};
const ghostButtonStyle: React.CSSProperties = {
  height: 32, padding: '0 14px', borderRadius: 0, border: '1px solid var(--eph-line-2)',
  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
  background: 'transparent', color: 'var(--eph-body)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer',
};
const dangerButtonStyle: React.CSSProperties = {
  height: 32, padding: '0 14px', borderRadius: 0, border: '1px solid var(--eph-danger)',
  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
  background: 'transparent', color: '#D99483', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', flexShrink: 0,
};
const primaryButtonStyle: React.CSSProperties = {
  height: 40, padding: '0 22px', borderRadius: 0, border: 'none',
  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
  background: 'var(--eph-accent)', color: 'var(--eph-ink)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', cursor: 'pointer',
};
const filterPillStyle = (active: boolean): React.CSSProperties => ({
  height: 30, padding: '0 14px', borderRadius: 9999,
  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
  border: active ? '1px solid var(--eph-accent)' : '1px solid var(--eph-line-2)',
  background: active ? 'rgba(201,166,107,.14)' : 'transparent',
  color: active ? 'var(--eph-accent)' : 'var(--eph-muted)',
  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer', marginRight: 8,
});

export function PhrasesPanel() {
  const [phrases, setPhrases] = useState<AdminPhrase[]>([]);
  const [filter, setFilter] = useState('all');
  const [newText, setNewText] = useState('');
  const [newContext, setNewContext] = useState('confirmacion');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editContext, setEditContext] = useState('confirmacion');
  const [preview, setPreview] = useState<Record<string, AdminPhrase | null>>({});
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const list = await listPhrases();
    setPhrases(list);
  }, []);

  useEffect(() => {
    refetch().catch((e: Error) => setError(e.message));
  }, [refetch]);

  async function handleCreate() {
    if (!newText.trim()) return;
    try {
      await createPhrase(newText.trim(), newContext);
      setNewText('');
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleToggleActive(phrase: AdminPhrase) {
    try {
      await updatePhrase(phrase.id, { active: !phrase.active });
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function startEdit(phrase: AdminPhrase) {
    setEditingId(phrase.id);
    setEditText(phrase.text);
    setEditContext(phrase.context);
  }

  async function handleSaveEdit(id: string) {
    if (!editText.trim()) return;
    try {
      await updatePhrase(id, { text: editText, context: editContext });
      setEditingId(null);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePhrase(id);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handlePreview(context: 'confirmacion' | 'instagram') {
    try {
      const current = preview[context];
      const drawn = await drawPreviewPhrase(context, current?.id);
      setPreview((prev) => ({ ...prev, [context]: drawn }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const list = filter === 'all' ? phrases : phrases.filter((p) => p.context === filter);

  return (
    <div style={cardStyle}>
      <h3 style={cardTitleStyle}>Frases Card RR.SS</h3>
      {error && <p role="alert" style={{ color: '#D99483', fontSize: 13 }}>{error}</p>}

      <div style={{ marginBottom: 16 }}>
        {CONTEXT_FILTERS.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setFilter(key)} style={filterPillStyle(filter === key)}>
            {label}
          </button>
        ))}
      </div>

      <div style={draftCardStyle}>
        <label style={labelStyle} htmlFor="ph-new-text">Nueva frase</label>
        <textarea id="ph-new-text" style={textareaStyle} value={newText} onChange={(e) => setNewText(e.target.value)} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={labelStyle} htmlFor="ph-new-context">Contexto</label>
            <select id="ph-new-context" style={selectStyle} value={newContext} onChange={(e) => setNewContext(e.target.value)}>
              <option value="confirmacion">Confirmación</option>
              <option value="instagram">Instagram</option>
              <option value="ambas">Ambas</option>
            </select>
          </div>
          <button type="button" onClick={handleCreate} style={primaryButtonStyle}>
            + Agregar frase
          </button>
        </div>
      </div>

      {list.length === 0 && <p style={{ color: 'var(--eph-muted)', fontSize: 13 }}>No hay frases para este filtro.</p>}
      {list.map((phrase) =>
        editingId === phrase.id ? (
          <div key={phrase.id} style={draftCardStyle}>
            <label style={labelStyle} htmlFor={`ph-edit-text-${phrase.id}`}>Frase</label>
            <textarea id={`ph-edit-text-${phrase.id}`} style={textareaStyle} value={editText} onChange={(e) => setEditText(e.target.value)} />
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={labelStyle} htmlFor={`ph-edit-context-${phrase.id}`}>Contexto</label>
                <select id={`ph-edit-context-${phrase.id}`} style={selectStyle} value={editContext} onChange={(e) => setEditContext(e.target.value)}>
                  <option value="confirmacion">Confirmación</option>
                  <option value="instagram">Instagram</option>
                  <option value="ambas">Ambas</option>
                </select>
              </div>
              <button type="button" onClick={() => handleSaveEdit(phrase.id)} style={primaryButtonStyle}>
                Guardar
              </button>
              <button type="button" onClick={() => setEditingId(null)} style={ghostButtonStyle}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div key={phrase.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--eph-line)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, color: 'var(--eph-text)', margin: 0 }}>{phrase.text}</p>
              <span style={{ fontSize: 11, color: 'var(--eph-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{phrase.context}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => handleToggleActive(phrase)}
                style={{
                  ...ghostButtonStyle,
                  borderColor: phrase.active ? 'var(--eph-accent)' : 'var(--eph-line)',
                  color: phrase.active ? 'var(--eph-accent)' : 'var(--eph-muted)',
                }}
              >
                {phrase.active ? '● Activa' : '○ Inactiva'}
              </button>
              <button type="button" onClick={() => startEdit(phrase)} style={ghostButtonStyle}>
                Editar
              </button>
              <button type="button" onClick={() => handleDelete(phrase.id)} style={dangerButtonStyle}>
                Eliminar
              </button>
            </div>
          </div>
        )
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 20 }}>
        <div style={{ ...draftCardStyle, flex: 1, minWidth: 220, marginBottom: 0 }}>
          <h4 style={{ fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 16, fontWeight: 400, color: 'var(--eph-text)', margin: '0 0 8px' }}>Pantalla de confirmación</h4>
          <p style={{ fontSize: 13, color: 'var(--eph-muted)', margin: '0 0 12px' }}>
            {preview.confirmacion ? preview.confirmacion.text : 'No hay frases activas para este contexto.'}
          </p>
          <button type="button" onClick={() => handlePreview('confirmacion')} style={{ ...ghostButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconShuffle size={13} /> Probar otra
          </button>
        </div>
        <div style={{ ...draftCardStyle, flex: 1, minWidth: 220, marginBottom: 0 }}>
          <h4 style={{ fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 16, fontWeight: 400, color: 'var(--eph-text)', margin: '0 0 8px' }}>Tarjeta de Instagram</h4>
          <p style={{ fontSize: 13, color: 'var(--eph-muted)', margin: '0 0 12px' }}>
            {preview.instagram ? preview.instagram.text : 'No hay frases activas para este contexto.'}
          </p>
          <button type="button" onClick={() => handlePreview('instagram')} style={{ ...ghostButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconShuffle size={13} /> Probar otra
          </button>
        </div>
      </div>
    </div>
  );
}
