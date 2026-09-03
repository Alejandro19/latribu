'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { getEvolutionData, updateNextCheckinDate } from '../../lib/evolution-client';
import { listCompletions as listCortisolCompletions, listCheckins as listCortisolCheckins, type CortisolCompletion, type CortisolCheckinRecord } from '../../lib/cortisol-client';
import { calculateCortisolWeeklyStats } from '../../lib/cortisol-logic';
import { listLogs as listSleepLogs, type SleepLog } from '../../lib/sleep-client';
import { listTrainingCompletions, type TrainingCompletion } from '../../lib/training-client';
import { calculateDisciplineStats } from '../../lib/training-home-logic';
import { fetchClient, type ClientDetail } from '../../lib/clients-client';
import { getWellnessIndex } from '../../lib/wellness-index-client';
import { listLabPanels, type LabPanel } from '../../lib/lab-panels-client';
import { AdminLabPanelReview } from '../admin/AdminLabPanelReview';
import {
  calculateSleepQualityAvg,
  formatSleepHours,
  monthlyAverages,
  EMOCION_SCORE,
  getWellnessTrendStatus,
} from '../../lib/evolution-logic';
import { showToast } from '../layout/AppShell';
import { WellnessIndexHero, BienestarGeneral, EvolucionFisicaSection } from './EvolutionVisuals';
import { CheckinAccordion } from './CheckinAccordion';
import { InsightsSection } from '../insights/InsightsSection';

const cardStyle: React.CSSProperties = {
  background: 'var(--eph-surface)', border: '1px solid var(--eph-line)',
  borderRadius: '0', padding: '22px 24px', marginBottom: 20,
};
const cardTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 18, fontWeight: 400, color: 'var(--eph-text)', margin: '0 0 16px',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace', fontSize: 10,
  textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 400, color: 'var(--eph-muted)', marginBottom: 6,
};
const fieldStyle: React.CSSProperties = {
  width: 220, height: 32, borderRadius: 0, border: 'none', borderBottom: '1px solid var(--eph-line-2)',
  padding: '0 2px 6px', fontSize: 15, fontWeight: 400, background: 'transparent', color: 'var(--eph-text)',
  outline: 'none', boxSizing: 'border-box',
};
const primaryButtonStyle: React.CSSProperties = {
  height: 40, padding: '0 22px', borderRadius: 0, border: 'none', marginTop: 12,
  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
  background: 'var(--eph-accent)', color: 'var(--eph-ink)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', cursor: 'pointer',
};

function clientTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

async function fetchEvolutionBundle(clientId: string) {
  const [evo, cortisolCompletions, cortisolCheckins, fullClient, sleepLogs, trainingCompletions, wellnessIndex, labPanels] = await Promise.all([
    getEvolutionData(clientId),
    listCortisolCompletions(clientId).catch(() => [] as CortisolCompletion[]),
    listCortisolCheckins(clientId).catch(() => [] as CortisolCheckinRecord[]),
    fetchClient(clientId).catch(() => null as ClientDetail | null),
    listSleepLogs(clientId).catch(() => [] as SleepLog[]),
    listTrainingCompletions(clientId).catch(() => [] as TrainingCompletion[]),
    getWellnessIndex(clientId).catch(() => null),
    listLabPanels(clientId).catch(() => [] as LabPanel[]),
  ]);
  return { evo, cortisolCompletions, cortisolCheckins, fullClient, sleepLogs, trainingCompletions, wellnessIndex, labPanels };
}

export function AdminEvolutionPanel({ clientId }: { clientId: string }) {
  const { data, error, isLoading, mutate } = useSWR(['evolution-bundle', clientId], () =>
    fetchEvolutionBundle(clientId),
  );
  const [nextCheckinDate, setNextCheckinDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setNextCheckinDate(data.fullClient?.nextCheckinDate || '');
  }, [data]);

  async function handleSaveNextCheckin() {
    setSaving(true);
    try {
      await updateNextCheckinDate(clientId, nextCheckinDate || null);
      showToast('Fecha guardada.', 'success');
      await mutate();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <p style={{ color: 'var(--eph-muted)', fontSize: 14 }}>Cargando evolución del cliente…</p>;
  if (error) return <p role="alert" style={{ color: 'var(--eph-danger)' }}>{(error as Error).message}</p>;
  if (!data) return null;

  const { evo, cortisolCompletions, cortisolCheckins, fullClient: client, sleepLogs, trainingCompletions, wellnessIndex, labPanels } = data;

  const sleepAvg = calculateSleepQualityAvg(evo.checkins);
  const weeklyRegulation = calculateCortisolWeeklyStats(cortisolCompletions).count;

  const sleepMonths = monthlyAverages(sleepLogs, 'date', 'quality');
  const sleepLast = sleepMonths.length ? sleepMonths[sleepMonths.length - 1].avg : null;
  const sleepPrev = sleepMonths.length >= 2 ? sleepMonths[sleepMonths.length - 2].avg : null;
  const sleepDelta = sleepLast != null && sleepPrev != null ? sleepLast - sleepPrev : null;

  const cortisolScored = cortisolCheckins
    .map((c) => ({ checkinDate: c.checkinDate, score: EMOCION_SCORE[c.emotion] ?? null }))
    .filter((c): c is { checkinDate: string; score: number } => c.score != null);
  const cortisolMonths = monthlyAverages(cortisolScored, 'checkinDate', 'score');
  const cortisolLast = cortisolMonths.length ? cortisolMonths[cortisolMonths.length - 1].avg : null;
  const cortisolPrev = cortisolMonths.length >= 2 ? cortisolMonths[cortisolMonths.length - 2].avg : null;
  const cortisolDelta = cortisolLast != null && cortisolPrev != null ? cortisolLast - cortisolPrev : null;

  const disciplineStats = client?.trainingDays ? calculateDisciplineStats(trainingCompletions, client.trainingDays) : null;

  return (
    <div>
      {client?.clientType === 'mentoring' && <InsightsSection clientId={clientId} moduleKey="miEvolucion" />}
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

      <WellnessIndexHero index={wellnessIndex?.value ?? null} />
      <BienestarGeneral
        sleepAvg={sleepAvg != null ? formatSleepHours(sleepAvg) : null}
        weeklyRegulation={weeklyRegulation}
        sleepDelta={sleepDelta}
        sleepStatus={getWellnessTrendStatus(sleepDelta)}
        cortisolDelta={cortisolDelta}
        cortisolStatus={getWellnessTrendStatus(cortisolDelta)}
      />
      <EvolucionFisicaSection
        anthropometrics={evo?.anthropometrics ?? []}
        inbody={evo?.inbody ?? []}
        objetivos={client?.objetivos}
        inbodyCadenceType={client?.inbodyCadenceType}
        disciplineStats={disciplineStats}
        streakWeeks={null}
      />

      <CheckinAccordion clientId={clientId} onSaved={() => mutate()} />

      {client?.clientType === 'mentoring' && (
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Laboratorios de seguimiento</h3>
          {[6, 12].map((semana) => (
            <div key={semana} style={{ marginBottom: 20 }}>
              <span style={labelStyle}>Semana {semana}</span>
              <div style={{ marginTop: 6 }}>
                <AdminLabPanelReview
                  clientId={clientId}
                  semana={semana}
                  panel={labPanels.find((p) => p.semanaNumero === semana)}
                  onApproved={() => { void mutate(); }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
