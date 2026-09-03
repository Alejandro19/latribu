'use client';

import { useState, useRef } from 'react';
import type { TrainingStreak } from '../../lib/training-client';
import { getPhraseByContext } from '../../lib/training-client';
import { drawInstagramCard } from '../../lib/training-card';
import { shareCanvasAsImage } from '../../lib/share-card';

export type SessionConfirmedScreenProps = {
  streak: TrainingStreak;
  phrase: string | null;
  clientId: string;
  onClose: () => void;
};

export function SessionConfirmedScreen({ streak, phrase, clientId, onClose }: SessionConfirmedScreenProps) {
  const dots = Array.from({ length: streak.sessionsRequiredThisWeek }, (_, i) => i + 1);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  async function handleShare() {
    setSharing(true);
    setShareError(null);
    try {
      let cardPhrase: string | null = null;
      try {
        cardPhrase = await getPhraseByContext(clientId, 'instagram');
      } catch {
        cardPhrase = null;
      }

      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
        canvasRef.current.width = 1080;
        canvasRef.current.height = 1920;
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo inicializar el canvas.');
      drawInstagramCard(ctx, { streakWeeks: streak.streakWeeks, phrase: cardPhrase });

      await shareCanvasAsImage(canvas, 'ephirox-racha.png');
    } catch (e) {
      console.error('[training] share failed:', e);
      setShareError('No pudimos generar la tarjeta. Intenta de nuevo.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 overflow-y-auto px-6 py-16 text-center" style={{ background: 'var(--eph-bg)' }}>
      <h1 className="font-display text-2xl" style={{ color: 'var(--eph-text)' }}>Sesión confirmada.</h1>

      <div className="flex flex-col items-center gap-4 border px-6 py-5" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
        <div className="flex gap-2">
          {dots.map((n) => (
            <span
              key={n}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-mono text-xs"
              style={
                n <= streak.sessionsDoneThisWeek
                  ? { background: 'var(--eph-accent)', color: 'var(--eph-ink)' }
                  : { border: '1px solid var(--eph-line-2)', color: 'var(--eph-body)' }
              }
            >
              {n <= streak.sessionsDoneThisWeek ? '✓' : n}
            </span>
          ))}
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--eph-muted)' }}>
          {streak.sessionsDoneThisWeek}/{streak.sessionsRequiredThisWeek} esta semana
        </p>
      </div>

      <p className="font-display text-2xl" style={{ color: 'var(--eph-accent)' }}>
        {streak.streakWeeks} {streak.streakWeeks === 1 ? 'semana seguida' : 'semanas seguidas'}
      </p>

      {phrase && (
        <p className="max-w-xs text-balance font-display text-sm italic leading-relaxed" style={{ color: 'var(--eph-accent-hi)' }}>
          &quot;{phrase}&quot;
        </p>
      )}
      {shareError && (
        <p role="alert" className="font-body text-xs" style={{ color: 'var(--eph-danger)' }}>
          {shareError}
        </p>
      )}

      <div className="flex w-full max-w-xs items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 rounded-[999px] border px-5 py-3 font-mono text-[10px] uppercase tracking-[0.1em]"
          style={{ borderColor: 'var(--eph-line-2)', color: 'var(--eph-text)' }}
        >
          Cerrar
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          className="flex flex-1 items-center justify-center gap-2 rounded-[999px] border px-5 py-3 font-mono text-[10px] uppercase tracking-[0.1em] disabled:cursor-default disabled:opacity-50"
          style={{ borderColor: 'var(--eph-line-2)', color: 'var(--eph-text)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" />
            <path d="M8 7l4-4 4 4" />
            <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
          </svg>
          Compartir
        </button>
      </div>
    </div>
  );
}
