'use client';

import { useEffect, useState } from 'react';
import {
  listTechniques,
  createTechnique,
  updateTechnique,
  deleteTechnique,
  uploadTechniqueVideo,
  uploadTechniqueAudio,
  type CortisolTechnique,
} from '../../lib/cortisol-client';
import { formatDurationLabel } from '../../lib/cortisol-logic';
import { showToast } from '../layout/AppShell';
import { CortisolTipsPanel } from './CortisolTipsPanel';
import Accordion from '../ui/Accordion';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';

const TECHNIQUE_TYPES = ['Respiración', 'Breathwork', 'Meditación', 'Mindfulness'];

const cardStyle: React.CSSProperties = {
  background: 'var(--paper)', border: '1px solid var(--line)',
  borderRadius: 'var(--radius)', padding: '22px 24px', marginBottom: 18,
};
const cardTitleStyle: React.CSSProperties = {
  fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: '0 0 16px',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 4,
};
const fieldStyle: React.CSSProperties = {
  width: '100%', height: 40, borderRadius: 10, border: '1px solid var(--line)',
  padding: '0 10px', fontSize: 13, background: 'var(--paper)', color: 'var(--ink)',
  outline: 'none', boxSizing: 'border-box',
};
const textareaStyle: React.CSSProperties = {
  ...fieldStyle, height: 'auto', minHeight: 72, padding: 10, resize: 'vertical', fontFamily: 'inherit',
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
  height: 40, padding: '0 22px', borderRadius: 9999, border: 'none',
  background: 'var(--sage)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
const listRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--line)',
};

type EditDraft = {
  title: string; type: string; minutes: string; seconds: string; youtubeUrl: string; description: string;
};

function draftFromTechnique(t: CortisolTechnique): EditDraft {
  return {
    title: t.title || '',
    type: t.type || TECHNIQUE_TYPES[0],
    minutes: t.durationMinutes != null ? String(t.durationMinutes) : '',
    seconds: t.durationSeconds != null ? String(t.durationSeconds) : '',
    youtubeUrl: t.youtubeUrl || '',
    description: t.description || '',
  };
}

export function AdminCortisolPanel({ clientId }: { clientId: string }) {
  const [techniques, setTechniques] = useState<CortisolTechnique[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [type, setType] = useState(TECHNIQUE_TYPES[0]);
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [description, setDescription] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editAudioFile, setEditAudioFile] = useState<File | null>(null);

  async function refetch() {
    setTechniques(await listTechniques(clientId));
  }

  useEffect(() => {
    setLoading(true);
    refetch()
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [clientId]);

  async function handleCreate() {
    if (!title.trim()) return;
    try {
      const created = await createTechnique(clientId, {
        title: title.trim(),
        type: type || undefined,
        duration: formatDurationLabel(minutes, seconds) || undefined,
        duration_minutes: minutes ? Number(minutes) : undefined,
        duration_seconds: seconds ? Number(seconds) : undefined,
        youtube_url: youtubeUrl || undefined,
        description: description || undefined,
      });
      if (audioFile) await uploadTechniqueAudio(clientId, created.id, audioFile);
      setTitle('');
      setType(TECHNIQUE_TYPES[0]);
      setMinutes('');
      setSeconds('');
      setYoutubeUrl('');
      setDescription('');
      setAudioFile(null);
      await refetch();
      showToast('Técnica asignada.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  function startEdit(t: CortisolTechnique) {
    setEditingId(t.id);
    setEditDraft(draftFromTechnique(t));
    setEditAudioFile(null);
  }

  async function handleSaveEdit(techId: string) {
    if (!editDraft || !editDraft.title.trim()) return;
    try {
      await updateTechnique(clientId, techId, {
        title: editDraft.title.trim(),
        type: editDraft.type || undefined,
        duration: formatDurationLabel(editDraft.minutes, editDraft.seconds) || undefined,
        duration_minutes: editDraft.minutes ? Number(editDraft.minutes) : null,
        duration_seconds: editDraft.seconds ? Number(editDraft.seconds) : null,
        youtube_url: editDraft.youtubeUrl || undefined,
        description: editDraft.description || undefined,
      });
      if (editAudioFile) await uploadTechniqueAudio(clientId, techId, editAudioFile);
      setEditingId(null);
      setEditDraft(null);
      await refetch();
      showToast('Técnica actualizada.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  async function handleRemoveAudio(techId: string) {
    try {
      await updateTechnique(clientId, techId, { audio_url: null, audio_name: null });
      await refetch();
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  async function handleDelete(techId: string) {
    try {
      await deleteTechnique(clientId, techId);
      await refetch();
      showToast('Técnica eliminada.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  async function handleUploadVideo(techId: string, file: File) {
    try {
      await uploadTechniqueVideo(clientId, techId, file);
      await refetch();
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  if (loading) return <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Cargando técnicas…</p>;

  return (
    <div>
      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>Asignar técnica</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div>
            <label style={labelStyle} htmlFor="ct-title">Título</label>
            <input id="ct-title" style={fieldStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="ct-type">Tipo</label>
            <select id="ct-type" style={fieldStyle} value={type} onChange={(e) => setType(e.target.value)}>
              {TECHNIQUE_TYPES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Duración (min : seg)</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input aria-label="Minutos" type="number" min={0} style={fieldStyle} placeholder="min" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
              <span style={{ color: 'var(--ink-soft)' }}>:</span>
              <input aria-label="Segundos" type="number" min={0} max={59} style={fieldStyle} placeholder="seg" value={seconds} onChange={(e) => setSeconds(e.target.value)} />
            </div>
          </div>
        </div>

        <label style={{ ...labelStyle, marginTop: 14 }} htmlFor="ct-youtube">Video (YouTube)</label>
        <input id="ct-youtube" style={fieldStyle} value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />

        <label style={{ ...labelStyle, marginTop: 14 }} htmlFor="ct-audio">Audio propio (opcional)</label>
        <input id="ct-audio" type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} />

        <label style={{ ...labelStyle, marginTop: 14 }} htmlFor="ct-desc">Descripción</label>
        <textarea id="ct-desc" rows={2} style={textareaStyle} value={description} onChange={(e) => setDescription(e.target.value)} />

        <button type="button" style={{ ...primaryButtonStyle, marginTop: 16 }} onClick={handleCreate}>
          Asignar
        </button>
      </div>

      <Accordion
        items={[
          {
            header: <span>Técnicas asignadas <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>— {techniques.length}</span></span>,
            content:
              techniques.length === 0 ? (
                <EmptyState message="Aún no hay técnicas asignadas." />
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {techniques.map((t) => (
                    <li key={t.id} style={listRowStyle}>
                      {editingId === t.id && editDraft ? (
                        <div style={{ width: '100%' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                            <div>
                              <label style={labelStyle} htmlFor={`ct-edit-title-${t.id}`}>Título</label>
                              <input id={`ct-edit-title-${t.id}`} style={fieldStyle} value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} />
                            </div>
                            <div>
                              <label style={labelStyle} htmlFor={`ct-edit-type-${t.id}`}>Tipo</label>
                              <select id={`ct-edit-type-${t.id}`} style={fieldStyle} value={editDraft.type} onChange={(e) => setEditDraft({ ...editDraft, type: e.target.value })}>
                                {TECHNIQUE_TYPES.map((o) => (
                                  <option key={o} value={o}>{o}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label style={labelStyle}>Duración (min : seg)</label>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input aria-label={`Minutos-${t.id}`} type="number" min={0} style={fieldStyle} value={editDraft.minutes} onChange={(e) => setEditDraft({ ...editDraft, minutes: e.target.value })} />
                                <span style={{ color: 'var(--ink-soft)' }}>:</span>
                                <input aria-label={`Segundos-${t.id}`} type="number" min={0} max={59} style={fieldStyle} value={editDraft.seconds} onChange={(e) => setEditDraft({ ...editDraft, seconds: e.target.value })} />
                              </div>
                            </div>
                          </div>
                          <label style={{ ...labelStyle, marginTop: 10 }} htmlFor={`ct-edit-youtube-${t.id}`}>Video (YouTube)</label>
                          <input id={`ct-edit-youtube-${t.id}`} style={fieldStyle} value={editDraft.youtubeUrl} onChange={(e) => setEditDraft({ ...editDraft, youtubeUrl: e.target.value })} />

                          <label style={{ ...labelStyle, marginTop: 10 }}>Audio propio</label>
                          {t.audioUrl && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                              <audio controls src={t.audioUrl} style={{ height: 32, maxWidth: 260 }} />
                              <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{t.audioName}</span>
                              <button type="button" style={ghostButtonStyle} onClick={() => handleRemoveAudio(t.id)}>Quitar audio</button>
                            </div>
                          )}
                          <input aria-label={`Audio-${t.id}`} type="file" accept="audio/*" onChange={(e) => setEditAudioFile(e.target.files?.[0] ?? null)} />

                          <label style={{ ...labelStyle, marginTop: 10 }} htmlFor={`ct-edit-desc-${t.id}`}>Descripción</label>
                          <textarea id={`ct-edit-desc-${t.id}`} rows={2} style={textareaStyle} value={editDraft.description} onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })} />

                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button type="button" style={primaryButtonStyle} onClick={() => handleSaveEdit(t.id)}>Guardar</button>
                            <button type="button" style={ghostButtonStyle} onClick={() => { setEditingId(null); setEditDraft(null); }}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ flex: 1 }}>
                            <strong>{t.title}</strong> {t.type && <Badge label={t.type} />}
                            <div style={{ color: 'var(--ink-soft)', fontSize: 13, marginTop: 4 }}>{t.duration}</div>
                          </div>
                          <label style={{ ...ghostButtonStyle, display: 'inline-flex', alignItems: 'center' }}>
                            Video
                            <input
                              type="file"
                              accept="video/*"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadVideo(t.id, file);
                              }}
                            />
                          </label>
                          <button type="button" style={ghostButtonStyle} onClick={() => startEdit(t)}>Editar</button>
                          <button type="button" style={dangerButtonStyle} onClick={() => handleDelete(t.id)}>Eliminar</button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ),
          },
          {
            header: 'Tips educativos ("Sabías que...")',
            content: (
              <div>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 14px' }}>
                  Se muestran al azar entre los que estén activos, uno por visita al módulo.
                </p>
                <CortisolTipsPanel />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
