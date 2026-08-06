'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { type RestTool, listRestTools } from '../../lib/rest-tools-client';
import EmptyState from '../ui/EmptyState';

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
    <span className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-[#F1EAF7] text-[#8A5FA0]">
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

  if (error) return <p role="alert" className="text-[var(--danger)]">{error}</p>;

  return (
    <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-[26px]">
      <h2 className="mb-4 font-serif text-lg font-bold text-[var(--ink)]">Herramientas para dormir</h2>
      {tools.length === 0 ? (
        <EmptyState message="Aún no hay herramientas." />
      ) : (
        tools.map((tool, i) => (
          <div key={tool.id} className={`py-3 ${i === 0 ? '' : 'border-t border-[var(--line)]'}`}>
            <div className="flex items-center gap-3">
              <RestToolIcon action={tool.action} />
              <div className="flex-1">
                <strong className="text-sm font-semibold text-[var(--ink)]">{tool.name}</strong>
                {tool.meta && <span className="ml-2 text-xs text-[var(--ink-soft)]">{tool.meta}</span>}
              </div>
              {tool.action === 'write' && (
                <button type="button" onClick={() => toggleJournal(tool.id)} className="rounded-full border border-[var(--line)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)]">
                  Escribir
                </button>
              )}
              {tool.action === 'play' && tool.audioUrl && (
                <button type="button" onClick={() => toggleAudio(tool.id)} className="rounded-full border border-[var(--line)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)]">
                  {playingAudioId === tool.id ? 'Ocultar' : 'Reproducir'}
                </button>
              )}
              {tool.action === 'play' && !tool.audioUrl && (
                <button type="button" onClick={() => startTimer(tool)} className="rounded-full border border-[var(--line)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)]">
                  Reproducir
                </button>
              )}
            </div>
            {playingAudioId === tool.id && tool.audioUrl && (
              <audio controls autoPlay src={tool.audioUrl} className="mt-2.5 w-full" />
            )}
            {journalOpenId === tool.id && (
              <div className="mt-2.5 rounded-xl border border-[#E7DFC9] bg-[#FBF7EC] p-3.5">
                <label htmlFor={`rt-journal-${tool.id}`} className="mb-2 block text-xs font-semibold text-[var(--ink-soft)]">
                  Escribe lo que ronda tu cabeza — no se guarda, es solo para vaciar la mente antes de dormir.
                </label>
                <textarea id={`rt-journal-${tool.id}`} rows={4} className="w-full rounded-[10px] border border-[#E7DFC9] p-2.5 text-sm" />
                <button type="button" onClick={() => toggleJournal(tool.id)} className="mt-2.5 rounded-full border border-[var(--line)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)]">
                  Listo
                </button>
              </div>
            )}
            {timerToolId === tool.id && (
              <div className="mt-2.5 rounded-xl bg-[#F1EAF7] p-4 text-center">
                {hasCountdown ? (
                  <p className="m-0 mb-2 font-serif text-xl font-bold text-[#8A5FA0]">
                    {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                  </p>
                ) : (
                  <p className="m-0 mb-2 text-sm font-semibold text-[#8A5FA0]">Reproduciendo…</p>
                )}
                <button type="button" onClick={stopTimer} className="rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)]">
                  Detener
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </section>
  );
}
