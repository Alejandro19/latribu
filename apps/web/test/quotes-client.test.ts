import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listQuotes,
  createQuote,
  updateQuote,
  deleteQuote,
  getQuoteOfTheDay,
  assignQuote,
  getClientAssignedQuoteId,
} from '../lib/quotes-client';

describe('quotes-client', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('lists quotes', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, quotes: [{ id: 'q1', quote: 'x', author: null, active: true }] }),
    });
    const result = await listQuotes();
    expect(result).toEqual([{ id: 'q1', quote: 'x', author: null, active: true }]);
  });

  it('creates a quote', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, quote: { id: 'q2', quote: 'nueva', author: 'Autor', active: true } }),
    });
    const result = await createQuote('nueva', 'Autor');
    expect(result.id).toBe('q2');
  });

  it('updates a quote', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, quote: { id: 'q1', quote: 'editada', author: null, active: true } }),
    });
    const result = await updateQuote('q1', { quote: 'editada' });
    expect(result.quote).toBe('editada');
  });

  it('deletes a quote', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ json: () => Promise.resolve({ success: true }) });
    await expect(deleteQuote('q1')).resolves.toBeUndefined();
  });

  it('gets the quote of the day', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, quote: { id: 'q1', quote: 'del día', author: null, active: true } }),
    });
    const result = await getQuoteOfTheDay('client-1');
    expect(result?.quote).toBe('del día');
  });

  it('returns null when there is no quote of the day', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ json: () => Promise.resolve({ success: true, quote: null }) });
    const result = await getQuoteOfTheDay('client-1');
    expect(result).toBeNull();
  });

  it('assigns a quote', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, client: { id: 'client-1', assignedQuoteId: 'q1' } }),
    });
    await expect(assignQuote('client-1', 'q1')).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/clients/client-1/assigned-quote'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ quote_id: 'q1' }) })
    );
  });

  it('gets the assigned quote id for a client', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, client: { assignedQuoteId: 'q9' } }),
    });
    const result = await getClientAssignedQuoteId('client-1');
    expect(result).toBe('q9');
  });

  it('throws when the backend reports failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ json: () => Promise.resolve({ success: false, error: 'La frase no puede estar vacía.' }) });
    await expect(createQuote('', null)).rejects.toThrow('La frase no puede estar vacía.');
  });
});
