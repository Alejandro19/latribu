'use client';

import { useEffect, useState } from 'react';
import { listTips, createTip, deleteTip, updateTip, type CortisolTip } from '../../lib/cortisol-tips-client';
import { showToast } from '../layout/AppShell';
import EmptyState from '../ui/EmptyState';

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 4,
};
const textareaStyle: React.CSSProperties = {
  width: '100%', borderRadius: 10, border: '1px solid var(--line)',
  padding: 10, fontSize: 13, background: 'var(--paper)', color: 'var(--ink)',
  outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
};
const ghostButtonStyle: React.CSSProperties = {
  height: 32, padding: '0 14px', borderRadius: 9999, border: '1px solid var(--line)',
  background: 'transparent', color: 'var(--ink-soft)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const dangerButtonStyle: React.CSSProperties = {
  height: 32, padding: '0 14px', borderRadius: 9999, border: '1px solid var(--danger)',
  background: 'transparent', color: 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
};
const primaryButtonStyle: React.CSSProperties = {
  height: 36, padding: '0 18px', borderRadius: 9999, border: 'none',
  background: 'var(--sage)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--line)',
};

export function CortisolTipsPanel() {
  const [tips, setTips] = useState<CortisolTip[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  async function refetch() {
    setTips(await listTips());
  }

  useEffect(() => {
    refetch()
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!content.trim()) return;
    try {
      await createTip(content.trim());
      setContent('');
      await refetch();
      showToast('Tip agregado.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  function startEdit(tip: CortisolTip) {
    setEditingId(tip.id);
    setEditContent(tip.content);
  }

  async function handleSaveEdit(tipId: string) {
    if (!editContent.trim()) return;
    try {
      await updateTip(tipId, { content: editContent.trim() });
      setEditingId(null);
      await refetch();
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  async function handleDelete(tipId: string) {
    try {
      await deleteTip(tipId);
      await refetch();
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  if (loading) return <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Cargando tips…</p>;

  return (
    <div>
      <label style={labelStyle} htmlFor="ctp-new-content">Nuevo tip</label>
      <textarea
        id="ctp-new-content"
        rows={2}
        style={textareaStyle}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Ej: la luz solar en los primeros 30 minutos del día ayuda a regular tu ritmo de cortisol natural."
      />
      <button type="button" style={{ ...primaryButtonStyle, marginTop: 10 }} onClick={handleCreate}>
        Agregar
      </button>

      <div style={{ marginTop: 16 }}>
        {tips.length === 0 ? (
          <EmptyState message="Aún no hay tips en el banco." />
        ) : (
          tips.map((tip) =>
            editingId === tip.id ? (
              <div key={tip.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                <textarea rows={2} style={textareaStyle} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" style={primaryButtonStyle} onClick={() => handleSaveEdit(tip.id)}>Guardar</button>
                  <button type="button" style={ghostButtonStyle} onClick={() => setEditingId(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div key={tip.id} style={{ ...rowStyle, opacity: tip.active ? 1 : 0.5 }}>
                <p style={{ margin: 0, flex: 1, fontSize: 13, color: 'var(--ink)' }}>{tip.content}</p>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button type="button" style={ghostButtonStyle} onClick={() => startEdit(tip)}>Editar</button>
                  <button type="button" style={dangerButtonStyle} onClick={() => handleDelete(tip.id)}>Eliminar</button>
                </div>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}
