'use client';

import { useCallback, useEffect, useState } from 'react';
import { getEvolutionData, type EvolutionData } from '../../lib/evolution-client';
import {
  listCompletions as listCortisolCompletions,
  listCheckins as listCortisolCheckins,
  type CortisolCompletion,
  type CortisolCheckinRecord,
} from '../../lib/cortisol-client';
import { calculateCortisolWeeklyStats } from '../../lib/cortisol-logic';
import { listLogs as listSleepLogs, type SleepLog } from '../../lib/sleep-client';
import { listTrainingCompletions, getStreak, type TrainingCompletion } from '../../lib/training-client';
import { calculateDisciplineStats } from '../../lib/training-home-logic';
import { fetchClient, type ClientDetail } from '../../lib/clients-client';
import { pickMantra } from '../../lib/mantra-bank';
import { COACH_WHATSAPP_NUMBER } from '../../lib/constants';
import {
  calculateSleepQualityAvg,
  formatSleepHours,
  monthlyAverages,
  EMOCION_SCORE,
  getWellnessTrendStatus,
  computeWellnessIndex,
} from '../../lib/evolution-logic';
import IdentityHeader from '../ui/IdentityHeader';
import MantraCard from '../ui/MantraCard';
import { WellnessIndexHero, BienestarGeneral, EvolucionFisicaSection, EvolucionFisicaLocked } from './EvolutionVisuals';
import { CheckinAccordion } from './CheckinAccordion';

function clientTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function ClientEvolutionPanel({ clientId }: { clientId: string }) {
  const [evolution, setEvolution] = useState<EvolutionData | null>(null);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [sleepAvg, setSleepAvg] = useState<number | null>(null);
  const [weeklyRegulation, setWeeklyRegulation] = useState<number | null>(null);
  const [sleepDelta, setSleepDelta] = useState<number | null>(null);
  const [cortisolDelta, setCortisolDelta] = useState<number | null>(null);
  const [disciplineStats, setDisciplineStats] = useState<{ doneDays: number; expected: number } | null>(null);
  const [wellnessIndex, setWellnessIndex] = useState<number | null>(null);
  const [streakWeeks, setStreakWeeks] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mantra] = useState(() => pickMantra('evolution'));

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [evo, cortisolCompletions, cortisolCheckins, fullClient, sleepLogs, trainingCompletions, streak] = await Promise.all([
        getEvolutionData(clientId),
        listCortisolCompletions(clientId).catch(() => [] as CortisolCompletion[]),
        listCortisolCheckins(clientId).catch(() => [] as CortisolCheckinRecord[]),
        fetchClient(clientId).catch(() => null),
        listSleepLogs(clientId).catch(() => [] as SleepLog[]),
        listTrainingCompletions(clientId).catch(() => [] as TrainingCompletion[]),
        getStreak(clientId, clientTz()).catch(() => null),
      ]);

      setEvolution(evo);
      setClient(fullClient);

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
      setStreakWeeks(streak?.streakWeeks ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const header = (
    <>
      <IdentityHeader title="Mi Evolución" subtitle="Tu proceso, en cifras." />
      {mantra && <MantraCard mantra={mantra} />}
    </>
  );

  if (loading) {
    return (
      <div>
        {header}
        <p className="text-sm text-[var(--ink-soft)]">Cargando tu evolución…</p>
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

  const accesoEvolucionFisica = client?.clientType !== 'lead_wellness';

  return (
    <div>
      {header}
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
          streakWeeks={streakWeeks}
        />
      ) : (
        <EvolucionFisicaLocked onCta={() => window.open(`https://wa.me/${COACH_WHATSAPP_NUMBER}`, '_blank')} />
      )}
      <CheckinAccordion clientId={clientId} onSaved={loadAll} />
    </div>
  );
}
