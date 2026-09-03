import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shareCanvasAsImage } from '../lib/share-card';

function createMockCanvas(blob: Blob | null) {
  return {
    toBlob: (cb: (b: Blob | null) => void) => cb(blob),
  } as unknown as HTMLCanvasElement;
}

describe('shareCanvasAsImage', () => {
  const originalShare = (navigator as unknown as { share?: unknown }).share;
  const originalCanShare = (navigator as unknown as { canShare?: unknown }).canShare;

  afterEach(() => {
    (navigator as unknown as { share?: unknown }).share = originalShare;
    (navigator as unknown as { canShare?: unknown }).canShare = originalCanShare;
    vi.restoreAllMocks();
  });

  it('uses navigator.share when canShare returns true', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    (navigator as unknown as { canShare: unknown }).canShare = vi.fn().mockReturnValue(true);
    (navigator as unknown as { share: unknown }).share = shareMock;

    const blob = new Blob(['fake'], { type: 'image/png' });
    const canvas = createMockCanvas(blob);

    await shareCanvasAsImage(canvas, 'la-tribu-racha.png');

    expect(shareMock).toHaveBeenCalledWith({ files: [expect.any(File)] });
  });

  it('falls back to a synthetic download when canShare is unavailable', async () => {
    (navigator as unknown as { canShare: unknown }).canShare = undefined;
    (navigator as unknown as { share: unknown }).share = undefined;

    const createObjectURL = vi.fn().mockReturnValue('blob:fake-url');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });

    const blob = new Blob(['fake'], { type: 'image/png' });
    const canvas = createMockCanvas(blob);

    await shareCanvasAsImage(canvas, 'la-tribu-racha.png');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  it('swallows an AbortError from navigator.share', async () => {
    const abortError = new DOMException('cancelled', 'AbortError');
    (navigator as unknown as { canShare: unknown }).canShare = vi.fn().mockReturnValue(true);
    (navigator as unknown as { share: unknown }).share = vi.fn().mockRejectedValue(abortError);

    const blob = new Blob(['fake'], { type: 'image/png' });
    const canvas = createMockCanvas(blob);

    await expect(shareCanvasAsImage(canvas, 'la-tribu-racha.png')).resolves.toBeUndefined();
  });

  it('re-throws a non-AbortError from navigator.share', async () => {
    (navigator as unknown as { canShare: unknown }).canShare = vi.fn().mockReturnValue(true);
    (navigator as unknown as { share: unknown }).share = vi.fn().mockRejectedValue(new Error('boom'));

    const blob = new Blob(['fake'], { type: 'image/png' });
    const canvas = createMockCanvas(blob);

    await expect(shareCanvasAsImage(canvas, 'la-tribu-racha.png')).rejects.toThrow('boom');
  });

  it('throws when canvas.toBlob yields a null blob', async () => {
    const canvas = createMockCanvas(null);

    await expect(shareCanvasAsImage(canvas, 'la-tribu-racha.png')).rejects.toThrow();
  });
});
