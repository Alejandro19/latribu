'use client';

import { useCallback, useEffect, useState } from 'react';
import { getEvolutionData, updateNextCheckinDate, type EvolutionData } from '../../lib/evolution-client';
import { listCompletions as listCortisolCompletions, listCheckins as listCortisolCheckins, type CortisolCompletion, type CortisolCheckinRecord } from '../../lib/cortisol-client';
import { calculateCortisolWeeklyStats } from '../../lib/cortisol-logic';
import { listLogs as listSleepLogs, type SleepLog } from '../../lib/sleep-client';
import { listTrainingCompletions, type TrainingCompletion } from '../../lib/training-client';
import { calculateDisciplineStats } from '../../lib/training-home-logic';
import { fetchClient, type ClientDetail } from '../../lib/clients-client';
import {
  calculateSleepQualityAvg,
  formatSleepHours,
  monthlyAverages,
  EMOCION_SCORE,
  getWellnessTrendStatus,
  computeWellnessIndex,
} from '../../lib/evolution-logic';
import { showToast } from '../layout/AppShell';
import { WellnessIndexHero, BienestarGeneral, EvolucionFisicaSection } from './EvolutionVisuals';
import { CheckinAccordion } from './CheckinAccordion';

const cardStyle: React.CSSProperties = {
  background: 'var(--paper)', border: '1px solid var(--line)',
  borderRadius: 'var(--radius)', padding: '22px 24px', marginBottom: 18,
};
const cardTitleStyle: React.CSSProperties = {
  fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: '0 0 16px',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 4,
};
const fieldStyle: React.CSSProperties = {
  width: 220, height: 40, borderRadius: 10, border: '1px solid var(--line)',
  padding: '0 10px', fontSize: 13, background: 'var(--paper)', color: 'var(--ink)',
  outline: 'none', boxSizing: 'border-box',
};
const primaryButtonStyle: React.CSSProperties = {
  height: 40, padding: '0 22px', borderRadius: 9999, border: 'none', marginTop: 12,
  background: 'var(--gold)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
};

function clientTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function AdminEvolutionPanel({ clientId }: { clientId: string }) {
  const [evolution, setEvolution] = useState<EvolutionData | null>(null);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [sleepAvg, setSleepAvg] = useState<number | null>(null);
  const [weeklyRegulation, setWeeklyRegulation] = useState<number | null>(null);
  const [sleepDelta, setSleepDelta] = useState<number | null>(null);
  const [cortisolDelta, setCortisolDelta] = useState<number | null>(null);
  const [disciplineStats, setDisciplineStats] = useState<{ doneDays: number; expected: number } | null>(null);
  const [wellnessIndex, setWellnessIndex] = useState<number | null>(null);
  const [nextCheckinDate, setNextCheckinDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [evo, cortisolCompletions, cortisolCheckins, fullClient, sleepLogs, trainingCompletions] = await Promise.all([
        getEvolutionData(clientId),
        listCortisolCompletions(clientId).catch(() => [] as CortisolCompletion[]),
        listCortisolCheckins(clientId).catch(() => [] as CortisolCheckinRecord[]),
        fetchClient(clientId).catch(() => null),
        listSleepLogs(clientId).catch(() => [] as SleepLog[]),
        listTrainingCompletions(clientId).catch(() => [] as TrainingCompletion[]),
      ]);

      setEvolution(evo);
      setClient(fullClient);
      setNextCheckinDate(fullClient?.nextCheckinDate || '');

      const avgSleep = calculateSleepQualityAvg(evo.checkins);
      setSleepAvg(avgSleep);
      setWeeklyRegulation(calculateCortisolWeeklyStats(cortisolCompletions).count);

      const sleepMonths = monthlyAverages(sleepLogs, 'date', 'quality');
      const sleepLast = sleepMonths.length ? sleepMonths[sleepMonths.length - 1].avg : null;
      const sleepPrev = sleepMonths.length >= 2 ? sleepMonths[sleepMonths.length - 2].avg : null;
      setSleepDelta(sleepLast != null && sleepPrev != null ? sleepLast - sleepPrev : null);

      const cortisolScored = cortisolCheckins
        .map((c) => ({ checkinDate: c.checkinDate, score: EMOCION_SCORE[c.emotion] ?? null }))
        .filter((c): c is { checkinDate: string; score: number } => c.score != null);
      const cortisolMonths = monthlyAverages(cortisolScored, 'checkinDate', 'score');
      const cortisolLast = cortisolMonths.length ? cortisolMonths[cortisolMonths.length - 1].avg : null;
      const cortisolPrev = cortisolMonths.length >= 2 ? cortisolMonths[cortisolMonths.length - 2].avg : null;
      setCortisolDelta(cortisolLast != null && cortisolPrev != null ? cortisolLast - cortisolPrev : null);

      const stats = fullClient?.trainingDays ? calculateDisciplineStats(trainingCompletions, fullClient.trainingDays) : null;
      setDisciplineStats(stats);
      setWellnessIndex(computeWellnessIndex({ trainingPct: stats?.pct ?? null, sleepAvg: sleepLast, cortisolAvg: cortisolLast }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleSaveNextCheckin() {
    setSaving(true);
    try {
      await updateNextCheckinDate(clientId, nextCheckinDate || null);
      showToast('Fecha guardada.', 'success');
      await loadAll();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Cargando evolución del cliente…</p>;
  if (error) return <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>;

  const accesoEvolucionFisica = client?.clientType !== 'lead_wellness';

  return (
    <div>
      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>Próxima medición (admin)</h3>
        <label style={labelStyle} htmlFor="ev-next-checkin">Fecha de la próxima medición</label>
        <input id="ev-next-checkin" type="date" style={fieldStyle} value={nextCheckinDate} onChange={(e) => setNextCheckinDate(e.target.value)} />
        <div>
          <button type="button" disabled={saving} style={{ ...primaryButtonStyle, opacity: saving ? 0.6 : 1 }} onClick={handleSaveNextCheckin}>
            {saving ? 'Guardando…' : 'Guardar fecha'}
          </button>
        </div>
      </div>

      <WellnessIndexHero index={wellnessIndex} />
      <BienestarGeneral
        sleepAvg={sleepAvg != null ? formatSleepHours(sleepAvg) : null}
        weeklyRegulation={weeklyRegulation}
        sleepDelta={sleepDelta}
        sleepStatus={getWellnessTrendStatus(sleepDelta)}
        cortisolDelta={cortisolDelta}
        cortisolStatus={getWellnessTrendStatus(cortisolDelta)}
      />
      {accesoEvolucionFisica ? (
        <EvolucionFisicaSection
          anthropometrics={evolution?.anthropometrics ?? []}
          inbody={evolution?.inbody ?? []}
          objetivos={client?.objetivos}
          inbodyCadenceType={client?.inbodyCadenceType}
          disciplineStats={disciplineStats}
          streakWeeks={null}
        />
      ) : (
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Tu evolución física</h3>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
            Este cliente es Lead Wellness — la evolución física se le muestra bloqueada hasta que se active con un coach.
          </p>
        </div>
      )}

      <CheckinAccordion clientId={clientId} onSaved={loadAll} />
    </div>
  );
}
