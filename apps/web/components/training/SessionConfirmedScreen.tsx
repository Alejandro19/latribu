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

      await shareCanvasAsImage(canvas, 'la-tribu-racha.png');
    } catch (e) {
      console.error('[training] share failed:', e);
      setShareError('No pudimos generar la tarjeta. Intenta de nuevo.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 overflow-y-auto bg-[#1B1712] px-6 py-16 text-center">
      <h1 className="font-serif text-2xl font-bold text-[#F3EFE6]">¡Sesión confirmada!</h1>

      <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#3A322A] bg-[#241E19] px-6 py-5">
        <div className="flex gap-2">
          {dots.map((n) => (
            <span
              key={n}
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                n <= streak.sessionsDoneThisWeek
                  ? 'bg-[#B8935A] text-white'
                  : 'border border-[#4A4038] text-[#B0A597]'
              }`}
            >
              {n <= streak.sessionsDoneThisWeek ? '✓' : n}
            </span>
          ))}
        </div>
        <p className="text-sm text-[#B0A597]">
          {streak.sessionsDoneThisWeek}/{streak.sessionsRequiredThisWeek} esta semana
        </p>
      </div>

      <p className="font-serif text-2xl font-bold text-[#D9A441]">
        {streak.streakWeeks} {streak.streakWeeks === 1 ? 'semana seguida' : 'semanas seguidas'}
      </p>

      {phrase && (
        <p className="max-w-xs text-balance font-serif text-sm italic leading-relaxed text-[#D9BE8C]">
          &quot;{phrase}&quot;
        </p>
      )}
      {shareError && (
        <p role="alert" className="text-xs text-[#E8A87C]">
          {shareError}
        </p>
      )}

      <div className="flex w-full max-w-xs items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-[#F3EFE6]"
        >
          Cerrar
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-[#F3EFE6] disabled:cursor-default disabled:opacity-50"
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
