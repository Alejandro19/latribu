'use client';

import React, { useEffect, useState, type FormEvent } from 'react';
import { acceptInvitationRequest, saveSession } from '@/lib/api-client';
import Isotipo from '@/components/ui/Isotipo';
import Button from '@/components/ui/Button';

const PANEL_BG = 'var(--eph-bg)';

export default function InvitacionPage(): React.ReactElement {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token'));
  }, []);

  // Sin pantalla de login intermedia: al crear la contraseña, el backend
  // devuelve una sesión ya autenticada (ver auth.controller.ts::acceptInvitation)
  // y se cae directo en /onboarding.
  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (!token) {
      setError('Este enlace es inválido. Pide al equipo que te reenvíe la invitación.');
      return;
    }
    setLoading(true);
    try {
      const result = await acceptInvitationRequest(token, password);
      if (!result.success || !result.token) {
        setError(result.error || 'No se pudo crear tu contraseña.');
        return;
      }
      saveSession(result.token);
      window.location.href = '/onboarding';
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

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
          <p className="relative z-[1] font-display italic text-[12.5px]" style={{ color: 'var(--eph-accent)' }}>Bienvenido a tu programa Premium.</p>
        </div>

        <div className="p-12 flex flex-col justify-center" style={{ background: PANEL_BG }}>
          <h2 className="font-display text-[22px] font-normal mb-2" style={{ color: 'var(--eph-text)' }}>
            Crea tu contraseña
          </h2>
          <p className="font-body text-sm mb-6" style={{ color: 'var(--eph-body)' }}>
            Último paso antes de comenzar tu onboarding.
          </p>

          <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
            {error && (
              <div role="alert" className="rounded-none border px-4 py-3 font-body text-sm" style={{ borderColor: 'var(--eph-danger)', background: 'rgba(138,74,60,0.14)', color: 'var(--eph-text)' }}>
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="invitation-password" className={labelClasses}>Contraseña</label>
              <input
                id="invitation-password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className={inputClasses}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="invitation-confirm-password" className={labelClasses}>Confirmar contraseña</label>
              <input
                id="invitation-confirm-password"
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
              {loading ? 'Creando…' : 'Crear contraseña y continuar'}
            </Button>
          </form>
        </div>

      </div>
    </div>
  );
}
