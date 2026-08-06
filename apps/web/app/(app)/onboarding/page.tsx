'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionToken } from '@/lib/api-client';
import { WizardShell } from '@/components/onboarding/WizardShell';

// El JWT ya trae el id del cliente en su payload (mismo `TokenPayload` que
// firma apps/api) — decodificarlo aquí evita un round-trip a /api/auth/me
// solo para saber "quién soy" antes de renderizar el wizard. La autorización
// real de cada llamada la sigue haciendo el backend (ownerOrAdmin) sin
// importar lo que este decode diga.
function decodeClientIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.id === 'string' ? payload.id : null;
  } catch {
    return null;
  }
}

// El módulo 10 (Dispositivos y Laboratorios) solo aplica a clientType
// "mentoring" — igual que el id, se lee del JWT para evitar un round-trip.
function decodeClientTypeFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.clientType === 'string' ? payload.clientType : null;
  } catch {
    return null;
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientType, setClientType] = useState<string | null>(null);

  useEffect(() => {
    const token = getSessionToken();
    if (!token) {
      router.push('/login');
      return;
    }
    // El decode es best-effort (ver comentario arriba): si el token no trae
    // un payload con `id` legible, igual dejamos avanzar el wizard — cada
    // llamada al backend sigue siendo autorizada por el token real, no por
    // este valor local.
    setClientId(decodeClientIdFromToken(token));
    setClientType(decodeClientTypeFromToken(token));
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return <WizardShell clientId={clientId ?? ''} clientType={clientType} />;
}
