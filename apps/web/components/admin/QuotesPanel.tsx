'use client';

import { useEffect, useState, useCallback } from 'react';
import { type MindsetQuote, listQuotes, createQuote, updateQuote, deleteQuote } from '../../lib/quotes-client';

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
    <div style={cardStyle}>
      <h3 style={cardTitleStyle}>Frases de mentalidad</h3>
      {error && <p role="alert" style={{ color: '#D99483', fontSize: 13 }}>{error}</p>}

      <div style={draftCardStyle}>
        <label style={labelStyle} htmlFor="qt-new-quote">Frase</label>
        <textarea id="qt-new-quote" style={textareaStyle} value={newQuote} onChange={(e) => setNewQuote(e.target.value)} />
        <label style={{ ...labelStyle, marginTop: 12 }} htmlFor="qt-new-author">Autor (opcional)</label>
        <input id="qt-new-author" style={fieldStyle} value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} />
        <button type="button" onClick={handleCreate} style={{ ...primaryButtonStyle, marginTop: 14 }}>
          Agregar
        </button>
      </div>

      {quotes.length === 0 && <p style={{ color: 'var(--eph-muted)', fontSize: 13 }}>Aún no hay frases en la biblioteca.</p>}
      {quotes.map((quote) =>
        editingId === quote.id ? (
          <div key={quote.id} style={draftCardStyle}>
            <label style={labelStyle} htmlFor={`qt-edit-quote-${quote.id}`}>Frase</label>
            <textarea id={`qt-edit-quote-${quote.id}`} style={textareaStyle} value={editQuote} onChange={(e) => setEditQuote(e.target.value)} />
            <label style={{ ...labelStyle, marginTop: 12 }} htmlFor={`qt-edit-author-${quote.id}`}>Autor (opcional)</label>
            <input id={`qt-edit-author-${quote.id}`} style={fieldStyle} value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => handleSaveEdit(quote.id)} style={primaryButtonStyle}>
                Guardar
              </button>
              <button type="button" onClick={() => setEditingId(null)} style={ghostButtonStyle}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div key={quote.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--eph-line)' }}>
            <div>
              <p style={{ fontSize: 14, color: 'var(--eph-text)', margin: 0 }}>{quote.quote}</p>
              {quote.author && <div style={{ fontSize: 12, color: 'var(--eph-muted)', marginTop: 4 }}>— {quote.author}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button type="button" onClick={() => startEdit(quote)} style={ghostButtonStyle}>
                Editar
              </button>
              <button type="button" onClick={() => handleDelete(quote.id)} style={dangerButtonStyle}>
                Eliminar
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
