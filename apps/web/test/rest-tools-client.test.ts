import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listRestTools,
  listAllRestTools,
  createRestTool,
  updateRestTool,
  deleteRestTool,
  uploadRestToolAudio,
  removeRestToolAudio,
} from '../lib/rest-tools-client';

const sampleTool = {
  id: 't1',
  name: 'Sonidos para dormir',
  meta: 'Ruido blanco',
  action: 'play',
  minutes: 20,
  seconds: null,
  audioUrl: null,
  audioName: null,
  active: true,
  sortOrder: 0,
};

describe('rest-tools-client', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('lists active tools', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, tools: [sampleTool] }),
    });
    const result = await listRestTools();
    expect(result).toEqual([sampleTool]);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/rest-tools'), expect.objectContaining({ method: 'GET' }));
  });

  it('lists all tools for admin', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, tools: [sampleTool] }),
    });
    const result = await listAllRestTools();
    expect(result).toEqual([sampleTool]);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/admin/rest-tools'), expect.objectContaining({ method: 'GET' }));
  });

  it('creates a tool', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, tool: { ...sampleTool, id: 't2', name: 'Nueva' } }),
    });
    const result = await createRestTool({ name: 'Nueva', action: 'write' });
    expect(result.id).toBe('t2');
  });

  it('updates a tool', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, tool: { ...sampleTool, active: false } }),
    });
    const result = await updateRestTool('t1', { active: false });
    expect(result.active).toBe(false);
  });

  it('deletes a tool', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ json: () => Promise.resolve({ success: true }) });
    await expect(deleteRestTool('t1')).resolves.toBeUndefined();
  });

  it('uploads audio via FormData', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, tool: { ...sampleTool, audioUrl: 'https://x/y.mp3', audioName: 'y.mp3' } }),
    });
    const file = new File(['fake'], 'y.mp3', { type: 'audio/mpeg' });
    const result = await uploadRestToolAudio('t1', file);
    expect(result.audioUrl).toBe('https://x/y.mp3');
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain('/api/admin/rest-tools/t1/upload-audio');
    expect(call[1].body).toBeInstanceOf(FormData);
  });

  it('removes audio by updating with null fields', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, tool: { ...sampleTool, audioUrl: null, audioName: null } }),
    });
    const result = await removeRestToolAudio('t1');
    expect(result.audioUrl).toBeNull();
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(call[1].body)).toEqual({ audioUrl: null, audioName: null });
  });

  it('throws when the backend reports failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ json: () => Promise.resolve({ success: false, error: 'Escribe un nombre.' }) });
    await expect(createRestTool({ name: '', action: 'write' })).rejects.toThrow('Escribe un nombre.');
  });
});
