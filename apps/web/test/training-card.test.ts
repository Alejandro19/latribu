import { describe, it, expect, vi } from 'vitest';
import { computeAchievements, drawInstagramCard } from '../lib/training-card';

describe('computeAchievements', () => {
  it('returns 0 medals and 0 trophies for a streak of 0', () => {
    expect(computeAchievements(0)).toEqual({ medalsInCurrentCycle: 0, trophiesEarned: 0 });
  });

  it('returns 0 medals and 1 trophy for a streak of exactly 4', () => {
    expect(computeAchievements(4)).toEqual({ medalsInCurrentCycle: 0, trophiesEarned: 1 });
  });

  it('returns 1 medal and 1 trophy for a streak of 5', () => {
    expect(computeAchievements(5)).toEqual({ medalsInCurrentCycle: 1, trophiesEarned: 1 });
  });

  it('returns 3 medals and 2 trophies for a streak of 11', () => {
    expect(computeAchievements(11)).toEqual({ medalsInCurrentCycle: 3, trophiesEarned: 2 });
  });
});

function createMockCtx() {
  return {
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 10 }),
    createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    letterSpacing: '0px',
  } as unknown as CanvasRenderingContext2D;
}

describe('drawInstagramCard', () => {
  it('fills the background and draws the streak number and brand text', () => {
    const ctx = createMockCtx();
    drawInstagramCard(ctx, { streakWeeks: 3, phrase: null });
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 1920);
    expect(ctx.fillText).toHaveBeenCalledWith('3', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('SEMANAS SEGUIDAS', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('La Tribu', expect.any(Number), expect.any(Number));
  });

  it('uses singular "SEMANA SEGUIDA" for a streak of exactly 1', () => {
    const ctx = createMockCtx();
    drawInstagramCard(ctx, { streakWeeks: 1, phrase: null });
    expect(ctx.fillText).toHaveBeenCalledWith('SEMANA SEGUIDA', expect.any(Number), expect.any(Number));
  });

  it('does not draw phrase text when phrase is null', () => {
    const ctx = createMockCtx();
    drawInstagramCard(ctx, { streakWeeks: 2, phrase: null });
    const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls.some((text: string) => text.includes('"'))).toBe(false);
  });

  it('wraps a long phrase across multiple fillText calls', () => {
    const ctx = createMockCtx();
    (ctx.measureText as ReturnType<typeof vi.fn>).mockImplementation((text: string) => ({
      width: text.length * 20,
    }));
    drawInstagramCard(ctx, { streakWeeks: 2, phrase: 'Una frase muy larga que definitivamente no cabe en una sola linea del diseño' });
    const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    const phraseLines = calls.filter((text: string) => text.includes('Una') || text.includes('frase') || text.includes('linea'));
    expect(phraseLines.length).toBeGreaterThan(1);
  });

  it('draws medal and trophy row text when the streak has achievements', () => {
    const ctx = createMockCtx();
    drawInstagramCard(ctx, { streakWeeks: 5, phrase: null });
    const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls.some((text: string) => text.includes('copas'))).toBe(true);
  });
});
