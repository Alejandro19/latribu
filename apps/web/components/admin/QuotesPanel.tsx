'use client';

import { useEffect, useState, useCallback } from 'react';
import { type MindsetQuote, listQuotes, createQuote, updateQuote, deleteQuote } from '../../lib/quotes-client';

export function QuotesPanel() {
  const [quotes, setQuotes] = useState<MindsetQuote[]>([]);
  const [newQuote, setNewQuote] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuote, setEditQuote] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const list = await listQuotes();
    setQuotes(list);
  }, []);

  useEffect(() => {
    refetch().catch((e: Error) => setError(e.message));
  }, [refetch]);

  async function handleCreate() {
    if (!newQuote.trim()) return;
    try {
      await createQuote(newQuote.trim(), newAuthor.trim() || null);
      setNewQuote('');
      setNewAuthor('');
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function startEdit(quote: MindsetQuote) {
    setEditingId(quote.id);
    setEditQuote(quote.quote);
    setEditAuthor(quote.author || '');
  }

  async function handleSaveEdit(id: string) {
    if (!editQuote.trim()) return;
    try {
      await updateQuote(id, { quote: editQuote, author: editAuthor.trim() || null });
      setEditingId(null);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteQuote(id);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section>
      <h2>Frases de mentalidad</h2>
      {error && <p role="alert">{error}</p>}

      <label htmlFor="qt-new-quote">Frase</label>
      <textarea id="qt-new-quote" value={newQuote} onChange={(e) => setNewQuote(e.target.value)} />
      <label htmlFor="qt-new-author">Autor (opcional)</label>
      <input id="qt-new-author" value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} />
      <button type="button" onClick={handleCreate}>
        Agregar
      </button>

      {quotes.length === 0 && <p>Aún no hay frases en la biblioteca.</p>}
      {quotes.map((quote) =>
        editingId === quote.id ? (
          <div key={quote.id}>
            <label htmlFor={`qt-edit-quote-${quote.id}`}>Frase</label>
            <textarea id={`qt-edit-quote-${quote.id}`} value={editQuote} onChange={(e) => setEditQuote(e.target.value)} />
            <label htmlFor={`qt-edit-author-${quote.id}`}>Autor (opcional)</label>
            <input id={`qt-edit-author-${quote.id}`} value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)} />
            <button type="button" onClick={() => handleSaveEdit(quote.id)}>
              Guardar
            </button>
            <button type="button" onClick={() => setEditingId(null)}>
              Cancelar
            </button>
          </div>
        ) : (
          <div key={quote.id}>
            <p>{quote.quote}</p>
            {quote.author && <div>— {quote.author}</div>}
            <button type="button" onClick={() => startEdit(quote)}>
              Editar
            </button>
            <button type="button" onClick={() => handleDelete(quote.id)}>
              Eliminar
            </button>
          </div>
        )
      )}
    </section>
  );
}
