'use client';

import React, { useEffect, useState, type FormEvent } from 'react';
import { resetPasswordRequest } from '@/lib/api-client';
import Isotipo from '@/components/ui/Isotipo';
import Button from '@/components/ui/Button';

const PANEL_BG = 'var(--eph-bg)';

export default function ResetPasswordPage(): React.ReactElement {
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token'));
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
    if (!token) {
      setError('El enlace es inválido o ya expiró. Solicita uno nuevo.');
      return;
    }
    setLoading(true);
    try {
      const result = await resetPasswordRequest(token, newPassword);
      if (!result.success) {
        setError(result.error || 'No se pudo actualizar la contraseña.');
        return;
      }
      setDone(true);
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

        {/* ========== LADO IZQUIERDO — IDENTIDAD EPHIROX ========== */}
        <div className="relative overflow-hidden p-12 flex flex-col items-center justify-center text-center" style={{ background: PANEL_BG }}>
          <div
            className="pointer-events-none absolute rounded-full"
            style={{ width: 260, height: 260, background: 'radial-gradient(circle, rgba(201,164,106,.18) 0%, transparent 70%)' }}
          />
          <Isotipo size={64} />
          <h1 className="relative z-[1] font-display text-2xl font-normal uppercase tracking-[0.16em] mt-[18px] mb-1.5" style={{ color: 'var(--eph-text)' }}>Ephirox</h1>
          <p className="relative z-[1] font-display italic text-[12.5px]" style={{ color: 'var(--eph-accent)' }}>Redefining limits.</p>
        </div>

        {/* ========== LADO DERECHO — FORMULARIO ========== */}
        <div className="p-12 flex flex-col justify-center" style={{ background: PANEL_BG }}>
          <h2 className="font-display text-[22px] font-normal mb-6" style={{ color: 'var(--eph-text)' }}>
            Nueva contraseña
          </h2>

          {done ? (
            <div className="space-y-4">
              <div role="status" className="rounded-none border px-4 py-3 font-body text-sm" style={{ borderColor: 'var(--eph-line-2)', background: 'var(--eph-surface)', color: 'var(--eph-text)' }}>
                Contraseña actualizada. Ya puedes iniciar sesión.
              </div>
              <div className="flex flex-col gap-2 text-center mt-4">
                <a href="/login" className="font-mono text-[11px] uppercase tracking-[0.16em] hover:opacity-80 transition-opacity" style={{ color: 'var(--eph-accent)' }}>Ir al acceso de miembros</a>
                <a href="/therapist-login" className="font-mono text-[11px] uppercase tracking-[0.16em] hover:opacity-80 transition-opacity" style={{ color: 'var(--eph-accent)' }}>Ir al acceso de terapeutas</a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
              {error && (
                <div role="alert" className="rounded-none border px-4 py-3 font-body text-sm" style={{ borderColor: 'var(--eph-danger)', background: 'rgba(138,74,60,0.14)', color: 'var(--eph-text)' }}>
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="new-password" className={labelClasses}>Nueva contraseña</label>
                <input
                  id="new-password"
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
                <label htmlFor="confirm-password" className={labelClasses}>Confirmar contraseña</label>
                <input
                  id="confirm-password"
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
                {loading ? 'Actualizando…' : 'Actualizar contraseña'}
              </Button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
