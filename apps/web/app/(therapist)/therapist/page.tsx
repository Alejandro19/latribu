'use client';

import { useEffect, useState } from 'react';
import { getSessionToken, decodeTokenPayload } from '@/lib/api-client';
import { TherapistShell } from '@/components/blindspot/TherapistShell';

export default function TherapistPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getSessionToken();
    if (!token) {
      window.location.href = '/therapist-login';
      return;
    }
    const payload = decodeTokenPayload<{ mustChangePassword?: boolean }>(token);
    if (payload?.mustChangePassword) {
      window.location.href = '/therapist/set-password';
      return;
    }
    setReady(true);
  }, []);

  if (!ready) return null;
  return <TherapistShell />;
}
