'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { type RestTool, listRestTools } from '../../lib/rest-tools-client';
import EmptyState from '../ui/EmptyState';
import Button from '../ui/Button';

const REST_TOOL_ICON_PATHS: Record<'sound' | 'journal', React.ReactNode> = {
  sound: <path d="M4 12h2M8 8v8M12 5v14M16 8v8M20 12h-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />,
  journal: (
    <>
      <path d="M6 4h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
};

function RestToolIcon({ action }: { action: string }) {
  return (
    <span className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full border" style={{ borderColor: 'var(--eph-line-2)', color: 'var(--eph-accent)' }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
        {REST_TOOL_ICON_PATHS[action === 'write' ? 'journal' : 'sound']}
      </svg>
    </span>
  );
}

export function RestToolsClientPanel() {
  const [tools, setTools] = useState<RestTool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [journalOpenId, setJournalOpenId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [timerToolId, setTimerToolId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [hasCountdown, setHasCountdown] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    listRestTools()
      .then(setTools)
      .catch((e: Error) => setError(e.message));
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setTimerToolId(null);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function startTimer(tool: RestTool) {
    stopTimer();
    setPlayingAudioId(null);
    const total = (tool.minutes || 0) * 60 + (tool.seconds || 0);
    setHasCountdown(total > 0);
    setSecondsLeft(total);
    setTimerToolId(tool.id);
    if (total > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            stopTimer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }

  function toggleJournal(id: string) {
    setJournalOpenId((prev) => (prev === id ? null : id));
  }

  function toggleAudio(id: string) {
    stopTimer();
    setPlayingAudioId((prev) => (prev === id ? null : id));
  }

  if (error) return <p role="alert" className="font-body" style={{ color: 'var(--eph-danger)' }}>{error}</p>;

  return (
    <section className="border-t py-6" style={{ borderColor: 'var(--eph-line)' }}>
      <h2 className="mb-4 font-display text-lg" style={{ color: 'var(--eph-text)' }}>Herramientas para dormir</h2>
      {tools.length === 0 ? (
        <EmptyState message="Aún no hay herramientas." />
      ) : (
        tools.map((tool, i) => (
          <div key={tool.id} className="py-3" style={{ borderTop: i === 0 ? 'none' : '1px solid var(--eph-line)' }}>
            <div className="flex items-center gap-3">
              <RestToolIcon action={tool.action} />
              <div className="flex-1">
                <strong className="font-body text-sm font-medium" style={{ color: 'var(--eph-text)' }}>{tool.name}</strong>
                {tool.meta && <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.06em]" style={{ color: 'var(--eph-muted)' }}>{tool.meta}</span>}
              </div>
              {tool.action === 'write' && (
                <Button type="button" variant="secondary" onClick={() => toggleJournal(tool.id)}>
                  Escribir
                </Button>
              )}
              {tool.action === 'play' && tool.audioUrl && (
                <Button type="button" variant="secondary" onClick={() => toggleAudio(tool.id)}>
                  {playingAudioId === tool.id ? 'Ocultar' : 'Reproducir'}
                </Button>
              )}
              {tool.action === 'play' && !tool.audioUrl && (
                <Button type="button" variant="secondary" onClick={() => startTimer(tool)}>
                  Reproducir
                </Button>
              )}
            </div>
            {playingAudioId === tool.id && tool.audioUrl && (
              <audio controls autoPlay src={tool.audioUrl} className="mt-2.5 w-full" />
            )}
            {journalOpenId === tool.id && (
              <div className="mt-2.5 border p-3.5" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface-2)' }}>
                <label htmlFor={`rt-journal-${tool.id}`} className="mb-2 block font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--eph-muted)' }}>
                  Escribe lo que ronda tu cabeza — no se guarda, es solo para vaciar la mente antes de dormir.
                </label>
                <textarea id={`rt-journal-${tool.id}`} rows={4} className="w-full border p-2.5 font-body text-sm" style={{ borderColor: 'var(--eph-line-2)', background: 'transparent', color: 'var(--eph-text)' }} />
                <Button type="button" variant="secondary" onClick={() => toggleJournal(tool.id)} className="mt-2.5">
                  Listo
                </Button>
              </div>
            )}
            {timerToolId === tool.id && (
              <div className="mt-2.5 border p-4 text-center" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface-2)' }}>
                {hasCountdown ? (
                  <p className="m-0 mb-2 font-display text-xl" style={{ color: 'var(--eph-accent)' }}>
                    {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                  </p>
                ) : (
                  <p className="m-0 mb-2 font-body text-sm font-medium" style={{ color: 'var(--eph-accent)' }}>Reproduciendo…</p>
                )}
                <Button type="button" variant="secondary" onClick={stopTimer}>
                  Detener
                </Button>
              </div>
            )}
          </div>
        ))
      )}
    </section>
  );
}
