'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { getCheckinsStatus } from '@/lib/checkins-client';
import { putPersonalInfo } from '@/lib/onboarding-client';
import Button from '@/components/ui/Button';

export function PeriodConfirmationCard({ clientId }: { clientId: string }) {
  const { data: status, mutate } = useSWR(['checkins-status', clientId], () => getCheckinsStatus(clientId));

  // Estado local "ya resuelto en esta sesión" — permite descartar "Aún no" de
  // período sin insistir de nuevo hoy mismo, sin esperar a que mutate()
  // traiga el status actualizado.
  const [periodDismissed, setPeriodDismissed] = useState(false);
  const [savingPeriod, setSavingPeriod] = useState(false);

  if (!status) return null;

  const showPeriod = status.periodConfirmationDue && !periodDismissed;
  if (!showPeriod) return null;

  async function handlePeriodo(yaLlego: boolean) {
    if (!yaLlego) {
      setPeriodDismissed(true);
      return;
    }
    setSavingPeriod(true);
    try {
      await putPersonalInfo(clientId, { last_period_date: new Date().toISOString().slice(0, 10) });
      setPeriodDismissed(true);
      await mutate();
    } finally {
      setSavingPeriod(false);
    }
  }

  return (
    <div className="mb-5 flex flex-col gap-5 rounded-none border border-[var(--eph-line)] bg-[var(--eph-surface)] p-5">
      <div>
        <p className="m-0 mb-2.5 text-[13px] font-semibold text-[var(--eph-text)]">¿Tu período ya llegó?</p>
        <div className="flex gap-2">
          <Button type="button" variant="primary" disabled={savingPeriod} onClick={() => handlePeriodo(true)}>
            Sí
          </Button>
          <Button type="button" variant="secondary" disabled={savingPeriod} onClick={() => handlePeriodo(false)}>
            Aún no
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PeriodConfirmationCard;
