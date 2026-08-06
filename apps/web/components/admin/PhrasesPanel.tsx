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

const CONTEXT_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'confirmacion', label: 'Confirmación' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'ambas', label: 'Ambas' },
];

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
    <section>
      <h2>Frases Card RR.SS</h2>
      {error && <p role="alert">{error}</p>}

      <div>
        {CONTEXT_FILTERS.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      <label htmlFor="ph-new-text">Nueva frase</label>
      <textarea id="ph-new-text" value={newText} onChange={(e) => setNewText(e.target.value)} />
      <label htmlFor="ph-new-context">Contexto</label>
      <select id="ph-new-context" value={newContext} onChange={(e) => setNewContext(e.target.value)}>
        <option value="confirmacion">Confirmación</option>
        <option value="instagram">Instagram</option>
        <option value="ambas">Ambas</option>
      </select>
      <button type="button" onClick={handleCreate}>
        + Agregar frase
      </button>

      {list.length === 0 && <p>No hay frases para este filtro.</p>}
      {list.map((phrase) =>
        editingId === phrase.id ? (
          <div key={phrase.id}>
            <label htmlFor={`ph-edit-text-${phrase.id}`}>Frase</label>
            <textarea id={`ph-edit-text-${phrase.id}`} value={editText} onChange={(e) => setEditText(e.target.value)} />
            <label htmlFor={`ph-edit-context-${phrase.id}`}>Contexto</label>
            <select id={`ph-edit-context-${phrase.id}`} value={editContext} onChange={(e) => setEditContext(e.target.value)}>
              <option value="confirmacion">Confirmación</option>
              <option value="instagram">Instagram</option>
              <option value="ambas">Ambas</option>
            </select>
            <button type="button" onClick={() => handleSaveEdit(phrase.id)}>
              Guardar
            </button>
            <button type="button" onClick={() => setEditingId(null)}>
              Cancelar
            </button>
          </div>
        ) : (
          <div key={phrase.id}>
            <p>{phrase.text}</p>
            <span>{phrase.context}</span>
            <button type="button" onClick={() => handleToggleActive(phrase)}>
              {phrase.active ? '● Activa' : '○ Inactiva'}
            </button>
            <button type="button" onClick={() => startEdit(phrase)}>
              Editar
            </button>
            <button type="button" onClick={() => handleDelete(phrase.id)}>
              Eliminar
            </button>
          </div>
        )
      )}

      <div>
        <div>
          <h3>Pantalla de confirmación</h3>
          <p>{preview.confirmacion ? preview.confirmacion.text : 'No hay frases activas para este contexto.'}</p>
          <button type="button" onClick={() => handlePreview('confirmacion')}>
            🔀 Probar otra
          </button>
        </div>
        <div>
          <h3>Tarjeta de Instagram</h3>
          <p>{preview.instagram ? preview.instagram.text : 'No hay frases activas para este contexto.'}</p>
          <button type="button" onClick={() => handlePreview('instagram')}>
            🔀 Probar otra
          </button>
        </div>
      </div>
    </section>
  );
}
