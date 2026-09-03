'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  type RestTool,
  listAllRestTools,
  createRestTool,
  updateRestTool,
  deleteRestTool,
  uploadRestToolAudio,
  removeRestToolAudio,
} from '../../lib/rest-tools-client';
import EmptyState from '../ui/EmptyState';

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
const ghostButtonStyle: React.CSSProperties = {
  height: 32, padding: '0 14px', borderRadius: 0, border: '1px solid var(--eph-line-2)',
  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
  background: 'transparent', color: 'var(--eph-body)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer',
};
const dangerButtonStyle: React.CSSProperties = {
  height: 32, padding: '0 14px', borderRadius: 0, border: '1px solid var(--eph-danger)',
  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
  background: 'transparent', color: 'var(--eph-danger)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', flexShrink: 0,
};
const primaryButtonStyle: React.CSSProperties = {
  height: 40, padding: '0 22px', borderRadius: 0, border: 'none',
  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
  background: 'var(--eph-accent)', color: 'var(--eph-ink)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', cursor: 'pointer',
};
const draftCardStyle: React.CSSProperties = {
  background: 'var(--eph-surface-2)', border: '1px solid var(--eph-line)', borderRadius: 0, padding: 16, marginBottom: 10,
};

export function RestToolsAdminPanel() {
  const [tools, setTools] = useState<RestTool[]>([]);
  const [newName, setNewName] = useState('');
  const [newMeta, setNewMeta] = useState('');
  const [newAction, setNewAction] = useState('play');
  const [newMinutes, setNewMinutes] = useState('');
  const [newSeconds, setNewSeconds] = useState('');
  const [newAudioFile, setNewAudioFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editMeta, setEditMeta] = useState('');
  const [editAction, setEditAction] = useState('play');
  const [editMinutes, setEditMinutes] = useState('');
  const [editSeconds, setEditSeconds] = useState('');
  const [editAudioFile, setEditAudioFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const list = await listAllRestTools();
    setTools(list);
  }, []);

  useEffect(() => {
    refetch().catch((e: Error) => setError(e.message));
  }, [refetch]);

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const created = await createRestTool({
        name: newName.trim(),
        meta: newMeta,
        action: newAction,
        minutes: newAction === 'play' ? (newMinutes ? Number(newMinutes) : null) : null,
        seconds: newAction === 'play' ? (newSeconds ? Number(newSeconds) : null) : null,
      });
      if (newAudioFile) {
        await uploadRestToolAudio(created.id, newAudioFile);
      }
      setNewName('');
      setNewMeta('');
      setNewMinutes('');
      setNewSeconds('');
      setNewAudioFile(null);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function startEdit(tool: RestTool) {
    setEditingId(tool.id);
    setEditName(tool.name);
    setEditMeta(tool.meta || '');
    setEditAction(tool.action);
    setEditMinutes(tool.minutes != null ? String(tool.minutes) : '');
    setEditSeconds(tool.seconds != null ? String(tool.seconds) : '');
    setEditAudioFile(null);
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return;
    try {
      await updateRestTool(id, {
        name: editName.trim(),
        meta: editMeta,
        action: editAction,
        minutes: editAction === 'play' ? (editMinutes ? Number(editMinutes) : null) : null,
        seconds: editAction === 'play' ? (editSeconds ? Number(editSeconds) : null) : null,
      });
      setEditingId(null);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteRestTool(id);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleUploadAudio(id: string) {
    if (!editAudioFile) return;
    try {
      await uploadRestToolAudio(id, editAudioFile);
      setEditAudioFile(null);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleRemoveAudio(id: string) {
    try {
      await removeRestToolAudio(id);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div style={cardStyle}>
      <h3 style={cardTitleStyle}>Herramientas para dormir (banco global)</h3>
      {error && <p role="alert" style={{ color: 'var(--eph-danger)' }}>{error}</p>}

      <div style={draftCardStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <div>
            <label style={labelStyle} htmlFor="rt-new-name">Nombre</label>
            <input id="rt-new-name" style={fieldStyle} value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="rt-new-action">Tipo</label>
            <select id="rt-new-action" style={fieldStyle} value={newAction} onChange={(e) => setNewAction(e.target.value)}>
              <option value="play">Reproducir (con temporizador)</option>
              <option value="write">Escribir (diario)</option>
            </select>
          </div>
          {newAction === 'play' && (
            <div>
              <label style={labelStyle}>Duración (min : seg)</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input aria-label="Minutos" id="rt-new-minutes" type="number" style={fieldStyle} value={newMinutes} onChange={(e) => setNewMinutes(e.target.value)} />
                <span style={{ color: 'var(--eph-muted)' }}>:</span>
                <input aria-label="Segundos" id="rt-new-seconds" type="number" style={fieldStyle} value={newSeconds} onChange={(e) => setNewSeconds(e.target.value)} />
              </div>
            </div>
          )}
        </div>
        <label style={{ ...labelStyle, marginTop: 10 }} htmlFor="rt-new-meta">Descripción</label>
        <input id="rt-new-meta" style={fieldStyle} value={newMeta} onChange={(e) => setNewMeta(e.target.value)} />
        <label style={{ ...labelStyle, marginTop: 10 }} htmlFor="rt-new-audio">Audio propio</label>
        <input
          id="rt-new-audio"
          type="file"
          accept="audio/*"
          onChange={(e) => setNewAudioFile(e.target.files?.[0] ?? null)}
        />
        <button type="button" style={{ ...primaryButtonStyle, marginTop: 14 }} onClick={handleCreate}>
          + Agregar herramienta
        </button>
      </div>

      {tools.length === 0 ? (
        <EmptyState message="Aún no hay herramientas." />
      ) : (
        tools.map((tool) =>
          editingId === tool.id ? (
            <div key={tool.id} style={draftCardStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle} htmlFor="rt-edit-name">Nombre</label>
                  <input id="rt-edit-name" style={fieldStyle} value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="rt-edit-action">Tipo</label>
                  <select id="rt-edit-action" style={fieldStyle} value={editAction} onChange={(e) => setEditAction(e.target.value)}>
                    <option value="play">Reproducir (con temporizador)</option>
                    <option value="write">Escribir (diario)</option>
                  </select>
                </div>
                {editAction === 'play' && (
                  <div>
                    <label style={labelStyle}>Duración (min : seg)</label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input aria-label="Minutos (edición)" type="number" style={fieldStyle} value={editMinutes} onChange={(e) => setEditMinutes(e.target.value)} />
                      <span style={{ color: 'var(--eph-muted)' }}>:</span>
                      <input aria-label="Segundos (edición)" type="number" style={fieldStyle} value={editSeconds} onChange={(e) => setEditSeconds(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
              <label style={{ ...labelStyle, marginTop: 10 }} htmlFor="rt-edit-meta">Descripción</label>
              <input id="rt-edit-meta" style={fieldStyle} value={editMeta} onChange={(e) => setEditMeta(e.target.value)} />

              <label style={{ ...labelStyle, marginTop: 10 }} htmlFor="rt-edit-audio">Audio propio</label>
              {tool.audioUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <audio controls src={tool.audioUrl} style={{ height: 32, maxWidth: 260 }} />
                  <span style={{ fontSize: 12, color: 'var(--eph-muted)' }}>{tool.audioName}</span>
                  <button type="button" style={ghostButtonStyle} onClick={() => handleRemoveAudio(tool.id)}>
                    Quitar audio
                  </button>
                </div>
              )}
              <input
                id="rt-edit-audio"
                type="file"
                accept="audio/*"
                onChange={(e) => setEditAudioFile(e.target.files?.[0] ?? null)}
              />
              <button type="button" style={{ ...ghostButtonStyle, marginTop: 8 }} onClick={() => handleUploadAudio(tool.id)}>
                {tool.audioUrl ? 'Reemplazar audio' : 'Subir audio'}
              </button>

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" style={primaryButtonStyle} onClick={() => handleSaveEdit(tool.id)}>
                  Guardar
                </button>
                <button type="button" style={ghostButtonStyle} onClick={() => setEditingId(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div key={tool.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--eph-line)' }}>
              <div style={{ flex: 1 }}>
                <strong>{tool.name}</strong>
                {tool.meta && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--eph-muted)' }}>{tool.meta}</span>}
              </div>
              <button type="button" style={ghostButtonStyle} onClick={() => startEdit(tool)}>
                Editar
              </button>
              <button type="button" style={dangerButtonStyle} onClick={() => handleDelete(tool.id)}>
                Eliminar
              </button>
            </div>
          )
        )
      )}
    </div>
  );
}
