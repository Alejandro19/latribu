'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionToken } from '@/lib/api-client';
import { getPersonalInfoAccess, type PersonalInfoVariant } from '@/lib/onboarding-client';
import { WizardShell } from '@/components/onboarding/WizardShell';
import LockedOverlay from '@/components/ui/LockedOverlay';

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

export default function OnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [variant, setVariant] = useState<PersonalInfoVariant>('none');

  useEffect(() => {
    const token = getSessionToken();
    if (!token) {
      router.push('/login');
      return;
    }
    const id = decodeClientIdFromToken(token);
    setClientId(id);
    // El módulo 10 (Dispositivos y Laboratorios) y el acceso mismo a este
    // formulario ahora los decide la matriz de "Roles y Perfiles", no un
    // clientType leído del token — ver require-personal-info-access
    // middleware en el backend.
    getPersonalInfoAccess(id ?? '')
      .then(setVariant)
      .catch(() => setVariant('none'))
      .finally(() => setReady(true));
  }, [router]);

  if (!ready) return null;

  if (variant === 'none') {
    return (
      <LockedOverlay title="Baseline no disponible" subtitle="Este módulo no está disponible para tu tipo de cuenta.">
        <div style={{ minHeight: 240 }} />
      </LockedOverlay>
    );
  }

  return <WizardShell clientId={clientId ?? ''} variant={variant} />;
}
