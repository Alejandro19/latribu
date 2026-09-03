'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { getSessionToken, saveSession, changePasswordRequest } from '@/lib/api-client';
import { getSafeRedirectTarget } from '@/lib/login-redirect';
import Isotipo from '@/components/ui/Isotipo';
import Button from '@/components/ui/Button';

// Mismo patrón visual que (auth)/login: identidad Ephirox, ambos paneles
// oscuros (--eph-bg), sin variante día/noche. A esta página llega un
// cliente al que el admin le asignó una contraseña temporal (ver
// AdminClientList → checkbox "Contraseña temporal"), redirigido acá desde
// (auth)/login justo después de autenticarse con esa contraseña.
const PANEL_BG = 'var(--eph-bg)';

export default function SetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getSessionToken()) {
      window.location.href = '/login';
      return;
    }
    setReady(true);
  }, []);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const result = await changePasswordRequest(currentPassword, newPassword);
      if (!result.success) {
        setError(result.error || 'No se pudo actualizar la contraseña.');
        return;
      }
      if (result.token) saveSession(result.token);
      window.location.href = getSafeRedirectTarget();
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;

  const inputClasses =
    'block w-full h-10 border-0 border-b border-[var(--eph-line-2)] rounded-none bg-transparent px-0.5 py-1.5 font-body text-[18px] font-normal text-[var(--eph-text)] outline-none transition-colors placeholder:text-[var(--eph-muted)] placeholder:opacity-70 focus:border-[var(--eph-accent)]';
  const labelClasses = 'block font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-[var(--eph-muted)]';

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ background: PANEL_BG }}>
      <div className="max-w-4xl w-full md:min-h-[600px] grid grid-cols-1 md:grid-cols-2 rounded-none border overflow-hidden" style={{ borderColor: 'var(--eph-line)' }}>
        <div className="relative overflow-hidden p-12 flex flex-col items-center justify-center text-center" style={{ background: PANEL_BG }}>
          <div
            className="pointer-events-none absolute rounded-full"
            style={{ width: 260, height: 260, background: 'radial-gradient(circle, rgba(201,164,106,.18) 0%, transparent 70%)' }}
          />
          <Isotipo size={64} />
          <h1 className="relative z-[1] font-display text-2xl font-normal uppercase tracking-[0.16em] mt-[18px] mb-1.5" style={{ color: 'var(--eph-text)' }}>Ephirox</h1>
          <p className="relative z-[1] font-display italic text-[12.5px]" style={{ color: 'var(--eph-accent)' }}>Redefining limits.</p>
        </div>

        <div className="p-12 flex flex-col justify-center" style={{ background: PANEL_BG }}>
          <h2 className="font-display text-[22px] font-normal mb-1.5" style={{ color: 'var(--eph-text)' }}>Crea tu contraseña</h2>
          <p className="font-body text-sm mb-6" style={{ color: 'var(--eph-body)' }}>
            Tu acceso fue creado con una contraseña temporal. Antes de continuar, define una definitiva.
          </p>
          <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
            {error && (
              <div role="alert" className="rounded-none border px-4 py-3 font-body text-sm" style={{ borderColor: 'var(--eph-danger)', background: 'rgba(138,74,60,0.14)', color: 'var(--eph-text)' }}>
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="set-password-current" className={labelClasses}>Contraseña temporal</label>
              <input
                id="set-password-current"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="La que te asignaron"
                className={inputClasses}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="set-password-new" className={labelClasses}>Nueva contraseña</label>
              <input
                id="set-password-new"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className={inputClasses}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="set-password-confirm" className={labelClasses}>Confirmar contraseña</label>
              <input
                id="set-password-confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                className={inputClasses}
              />
            </div>
            <Button type="submit" variant="primary" disabled={loading} className="w-full">
              {loading ? 'Guardando…' : 'Guardar y continuar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
