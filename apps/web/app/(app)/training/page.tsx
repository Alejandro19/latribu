'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { confirmSession, type TrainingStreak } from '@/lib/training-client';
import { captureIncomingDeepLink, getPendingAction, clearPendingAction, isTrainingConfirmAction } from '@/lib/deep-link';
import { TrainingShell } from '@/components/training/TrainingShell';
import { SessionConfirmedScreen } from '@/components/training/SessionConfirmedScreen';
import { AdminTrainingPanel } from '@/components/training/AdminTrainingPanel';
import ClientSwitcher from '@/components/admin/ClientSwitcher';
import IdentityHeader from '@/components/ui/IdentityHeader';
import { showToast } from '@/components/layout/AppShell';

function clientTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export default function TrainingPage() {
  const router = useRouter();
  // AppShell ya bloquea el render de esta página hasta que useAuth() termina
  // de cargar (ver components/layout/AppShell.tsx) — leer directo de acá evita
  // el doble-render que causaba decodificar el JWT de nuevo en cada page.tsx.
  const { role, user, clientType } = useAuth();
  const clientId = user?.id ?? null;
  // Un admin no tiene ficha de cliente propia, así que para él no hace falta
  // resolver el deep-link/NFC — solo aplica al flujo de auto-servicio de un
  // cliente real, y por eso sigue siendo un paso async propio de esta página.
  const [ready, setReady] = useState(role === 'admin');
  const [adminClientId, setAdminClientId] = useState<string | null>(null);
  const [nfcResult, setNfcResult] = useState<{ streak: TrainingStreak; phrase: string | null } | null>(null);
  // React (Strict Mode, en dev) vuelve a correr este efecto una segunda vez
  // al montar. `router.replace('/training')` es asíncrono, así que en esa
  // segunda pasada `window.location.search` todavía tenía el `?m=...&a=...`
  // — captureIncomingDeepLink lo volvía a escribir en localStorage y
  // confirmSession se disparaba dos veces casi en simultáneo (la segunda
  // llamada terminaba en un error no relacionado con el usuario). Este ref
  // asegura que la acción NFC se procese una sola vez por instancia de página.
  const nfcHandledRef = useRef(false);

  useEffect(() => {
    if (role === 'admin') {
      setReady(true);
      return;
    }
    if (role !== 'cliente') return;
    if (nfcHandledRef.current) return;

    captureIncomingDeepLink(window.location.search);
    // Se lee una sola vez y se limpia de inmediato si existe (consumir-o-descartar):
    // cualquier acción pendiente, reconocida o no, no debe quedar viva para una
    // próxima visita.
    const pending = getPendingAction();
    if (pending) clearPendingAction();
    const hasNfcAction = isTrainingConfirmAction(pending);

    if (hasNfcAction) {
      nfcHandledRef.current = true;
      router.replace('/training');
      confirmSession(clientId ?? '', clientTz(), 'nfc')
        .then((result) => {
          if (result.alreadyConfirmedToday) {
            showToast('Ya confirmaste tu sesión de hoy — vuelve mañana para el siguiente día.', 'info');
          } else {
            setNfcResult({ streak: result.streak, phrase: result.phrase });
          }
        })
        .catch((e: Error) => {
          // El deep-link nunca bloquea el login normal: si falla al consumirse
          // (red, permisos, cliente sin training_days), se descarta silenciosamente
          // y el cliente cae al flujo normal de /training.
          console.error('[training] NFC confirm-session failed (non-fatal):', e);
        })
        .finally(() => setReady(true));
      return;
    }

    setReady(true);
  }, [role, clientId, router]);

  if (!ready) return null;

  if (role === 'admin') {
    return (
      <div>
        <IdentityHeader title="Workout" subtitle="Configura la rutina y el ritmo semanal de cada cliente." />
        <div
          style={{
            background: 'var(--eph-surface)', border: '1px solid var(--eph-line)',
            borderRadius: 0, padding: '22px 24px', marginBottom: 18,
          }}
        >
          <ClientSwitcher moduleKey="training" selectedClientId={adminClientId} onSelect={setAdminClientId} />
        </div>
        {adminClientId ? (
          <AdminTrainingPanel clientId={adminClientId} />
        ) : (
          <p className="font-body" style={{ color: 'var(--eph-body)', fontSize: 13 }}>Selecciona un cliente para gestionar su entrenamiento.</p>
        )}
      </div>
    );
  }

  if (nfcResult) {
    return (
      <SessionConfirmedScreen
        streak={nfcResult.streak}
        phrase={nfcResult.phrase}
        clientId={clientId ?? ''}
        onClose={() => setNfcResult(null)}
      />
    );
  }

  return <TrainingShell clientId={clientId ?? ''} clientType={clientType} />;
}
