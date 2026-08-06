'use client';

import { useEffect, useState } from 'react';
import {
  listTechniques,
  listCompletions,
  markCompletion,
  getTodayCheckin,
  postCheckin,
  getTipOfTheDay,
  type CortisolTechnique,
  type CortisolTip,
  type CortisolCheckin,
  type CortisolCompletion,
} from '../../lib/cortisol-client';
import { youtubeEmbedUrl } from '../../lib/training-timer-logic';
import { CORTISOL_EMOTIONS, CORTISOL_RECOMMENDATIONS, calculateCortisolWeeklyStats } from '../../lib/cortisol-logic';
import IdentityHeader from '../ui/IdentityHeader';
import BreathCircles from '../ui/BreathCircles';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import MiniRing from '../ui/MiniRing';
import ProgressBar from '../ui/ProgressBar';

const TECHNIQUE_ICON_PATHS: Record<string, React.ReactNode> = {
  respiración: <path d="M3 10c2.5-3 4.5-3 7 0s4.5 3 7 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />,
  breathwork: <path d="M3 10c2.5-3 4.5-3 7 0s4.5 3 7 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />,
  meditación: <path d="M10 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-6 12c1-3.5 3.5-5.5 6-5.5s5 2 6 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />,
  mindfulness: (
    <>
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <circle cx="10" cy="10" r="2" fill="currentColor" />
    </>
  ),
  base: (
    <>
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M10 6.5v4l2.6 1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
};

function TechniqueIcon({ type }: { type: string | null }) {
  const key = (type || '').toLowerCase();
  const path = TECHNIQUE_ICON_PATHS[key] || TECHNIQUE_ICON_PATHS.base;
  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#F1F5EC] text-[#5B7A4E]">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        {path}
      </svg>
    </div>
  );
}

function CortisolPlayer({
  technique,
  doneToday,
  onComplete,
  onBack,
}: {
  technique: CortisolTechnique;
  doneToday: boolean;
  onComplete: () => void;
  onBack: () => void;
}) {
  const embedUrl = youtubeEmbedUrl(technique.youtubeUrl);
  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 inline-block bg-transparent p-0 text-xs font-semibold text-[#5C574E] hover:underline">
        ← Gestión de Cortisol
      </button>
      <h1 className="mb-1 font-serif text-2xl font-bold text-[var(--ink)]">{technique.title}</h1>
      <p className="mb-5 text-sm text-[var(--ink-soft)]">{[technique.type, technique.duration].filter(Boolean).join(' · ')}</p>

      <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-[26px]">
        {embedUrl ? (
          <div className="relative overflow-hidden rounded-[14px] bg-black pt-[56.25%]">
            <iframe
              src={embedUrl}
              title={technique.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        ) : technique.audioUrl ? (
          <div className="rounded-[14px] bg-[#F1EAF7] p-6 text-center">
            <audio src={technique.audioUrl} controls className="w-full" />
          </div>
        ) : (
          <div className="py-10 text-center text-[var(--ink-soft)]">Sin video ni audio asignado.</div>
        )}

        {technique.description && <p className="mt-4 text-sm leading-relaxed text-[var(--ink)]">{technique.description}</p>}

        <div className="mt-5 flex justify-center gap-2.5">
          {doneToday ? (
            <button type="button" disabled className="h-11 cursor-default rounded-full border border-[var(--line)] px-6 text-sm font-semibold text-[var(--ink-soft)]">
              Completado hoy ✓
            </button>
          ) : (
            <button type="button" onClick={onComplete} className="h-11 rounded-full bg-[#5B7A4E] px-6 text-sm font-semibold text-white">
              Marcar completado
            </button>
          )}
          <button type="button" onClick={onBack} className="h-11 rounded-full bg-[#2B2621] px-6 text-sm font-semibold text-white">
            Finalizar
          </button>
        </div>
      </div>
    </div>
  );
}

export function ClientCortisolPanel({ clientId }: { clientId: string }) {
  const [techniques, setTechniques] = useState<CortisolTechnique[]>([]);
  const [completions, setCompletions] = useState<CortisolCompletion[]>([]);
  const [tip, setTip] = useState<CortisolTip>(null);
  const [checkin, setCheckin] = useState<CortisolCheckin>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  async function refetch() {
    const [techniqueList, completionList, tipOfDay, todayCheckin] = await Promise.all([
      listTechniques(clientId),
      listCompletions(clientId).catch(() => []),
      getTipOfTheDay(clientId),
      getTodayCheckin(clientId),
    ]);
    setTechniques(techniqueList);
    setCompletions(completionList);
    setTip(tipOfDay);
    setCheckin(todayCheckin);
  }

  useEffect(() => {
    refetch()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  async function handleSelectEmotion(key: string) {
    try {
      const saved = await postCheckin(clientId, key);
      setCheckin(saved);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleComplete(techniqueId: string) {
    try {
      await markCompletion(clientId);
      const completionList = await listCompletions(clientId).catch(() => completions);
      setCompletions(completionList);
    } catch (e) {
      setError((e as Error).message);
    }
    void techniqueId;
  }

  const header = <IdentityHeader title="Gestión de Cortisol" subtitle="Es momento de bajar el ritmo." />;

  if (loading) {
    return (
      <div>
        {header}
        <p className="text-sm text-[var(--ink-soft)]">Cargando técnicas de cortisol…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div>
        {header}
        <p role="alert" className="text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  const active = activeId ? techniques.find((t) => t.id === activeId) : null;
  if (active) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const doneToday = completions.some((c) => c.completedDate === todayStr);
    return (
      <div>
        {header}
        <CortisolPlayer
          technique={active}
          doneToday={doneToday}
          onBack={() => setActiveId(null)}
          onComplete={() => handleComplete(active.id)}
        />
      </div>
    );
  }

  const emotion = checkin ? checkin.emotion : null;
  const recommended = (emotion && CORTISOL_RECOMMENDATIONS[emotion]) || CORTISOL_RECOMMENDATIONS.cansado;
  const matched =
    techniques.find((t) => (t.title || '').trim().toLowerCase() === recommended.title.toLowerCase()) || techniques[0] || null;
  const weeklyStats = calculateCortisolWeeklyStats(completions);

  return (
    <div>
      {header}

      <div className="mb-5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-[18px_20px]">
        <p className="mb-2.5 text-xs font-bold text-[var(--ink)]">¿Cómo te sientes ahora mismo?</p>
        <div className="grid grid-cols-3 gap-2">
          {CORTISOL_EMOTIONS.map((o) => {
            const selected = emotion === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => handleSelectEmotion(o.key)}
                className={`rounded-xl border px-1.5 py-2 text-center transition-colors ${
                  selected ? 'border-[#5B7A4E] bg-[#5B7A4E]' : 'border-[#D9E4CE] bg-[#FBFDF9]'
                }`}
              >
                <span className="mb-0.5 block text-[17px] leading-none">{o.emoji}</span>
                <span className={`block text-[10px] font-bold leading-tight ${selected ? 'text-white' : 'text-[var(--ink-soft)]'}`}>{o.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="relative mb-5 overflow-hidden rounded-[20px] p-7 text-center"
        style={{ background: 'linear-gradient(180deg, #EFF5E8, #DCE8CC)' }}
      >
        <BreathCircles />
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#6B8A5A]">Recomendada para ti ahora</p>
        <h3 className="mb-1 font-serif text-lg font-bold text-[#3E4A34]">{recommended.title}</h3>
        <p className="mb-3 text-sm text-[#6B7A5E]">{recommended.desc}</p>
        {matched && (
          <button
            type="button"
            onClick={() => setActiveId(matched.id)}
            className="h-11 rounded-full bg-[#5B7A4E] px-6 text-sm font-semibold text-white"
          >
            Empezar técnica
          </button>
        )}
      </div>

      <section className="mb-5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-[26px]">
        <h2 className="mb-4 font-serif text-lg font-bold text-[var(--ink)]">Tus técnicas</h2>
        {techniques.length === 0 ? (
          <EmptyState message="Aún no tienes técnicas asignadas." />
        ) : (
          <div>
            {techniques.map((t, i) => {
              const hasVideo = !!(t.youtubeUrl || t.videoUrl);
              const hasAudio = !!t.audioUrl;
              const isPlayingAudio = playingAudioId === t.id;
              return (
                <div key={t.id} className={`py-3 ${i === 0 ? '' : 'border-t border-[#E8EEDF]'}`}>
                  <div className="flex items-center gap-3">
                    <TechniqueIcon type={t.type} />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-[var(--ink)]">
                        {t.title} {t.type && <Badge label={t.type} />}
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--ink-soft)]">{t.duration}</div>
                    </div>
                    {hasVideo && (
                      <button type="button" onClick={() => setActiveId(t.id)} className="rounded-full border border-[var(--line)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)]">
                        Reproducir
                      </button>
                    )}
                    {!hasVideo && hasAudio && (
                      <button
                        type="button"
                        onClick={() => setPlayingAudioId((prev) => (prev === t.id ? null : t.id))}
                        className="rounded-full border border-[var(--line)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)]"
                      >
                        {isPlayingAudio ? 'Ocultar' : 'Reproducir'}
                      </button>
                    )}
                  </div>
                  {isPlayingAudio && hasAudio && (
                    <audio controls autoPlay src={t.audioUrl ?? undefined} className="mt-2.5 w-full" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {techniques.length > 0 && (
        <section className="mb-5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-[26px]">
          <h2 className="mb-4 font-serif text-lg font-bold text-[var(--ink)]">Momento de regulación</h2>
          <div className="flex items-center gap-4">
            <MiniRing pct={weeklyStats.pct} strokeColor="#5B7A4E" trackColor="#D9E4CE" />
            <div className="flex-1">
              <ProgressBar done={weeklyStats.count} total={7} label="Esta semana" />
            </div>
          </div>
        </section>
      )}

      {tip && (
        <div className="rounded-[var(--radius)] border border-dashed border-[#D9E4CE] bg-[#FBFDF9] p-[18px_20px]">
          <p className="m-0 text-xs text-[#4B5A3F]">
            <strong>Sabías que</strong> {tip.content}
          </p>
        </div>
      )}
    </div>
  );
}
