import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listPhrases, createPhrase, updatePhrase, deletePhrase, drawPreviewPhrase } from '../lib/phrases-client';

describe('phrases-client (admin)', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('lists phrases', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, phrases: [{ id: 'p1', text: 'x', context: 'ambas', active: true }] }),
    });
    const result = await listPhrases();
    expect(result).toEqual([{ id: 'p1', text: 'x', context: 'ambas', active: true }]);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/admin/phrases'), expect.objectContaining({ method: 'GET' }));
  });

  it('creates a phrase', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, phrase: { id: 'p2', text: 'nueva', context: 'instagram', active: true } }),
    });
    const result = await createPhrase('nueva', 'instagram');
    expect(result.id).toBe('p2');
  });

  it('updates a phrase', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, phrase: { id: 'p1', text: 'x', context: 'ambas', active: false } }),
    });
    const result = await updatePhrase('p1', { active: false });
    expect(result.active).toBe(false);
  });

  it('deletes a phrase', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ json: () => Promise.resolve({ success: true }) });
    await expect(deletePhrase('p1')).resolves.toBeUndefined();
  });

  it('draws a preview phrase', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, phrase: { id: 'p3', text: 'preview', context: 'confirmacion', active: true } }),
    });
    const result = await drawPreviewPhrase('confirmacion', 'p1');
    expect(result?.id).toBe('p3');
  });

  it('throws when the backend reports failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ json: () => Promise.resolve({ success: false, error: 'Contexto inválido.' }) });
    await expect(createPhrase('x', 'bogus')).rejects.toThrow('Contexto inválido.');
  });
});
