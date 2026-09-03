'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { getSessionToken, saveSession, changePasswordRequest } from '@/lib/api-client';
import Isotipo from '@/components/ui/Isotipo';
import Button from '@/components/ui/Button';

export default function TherapistSetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = getSessionToken();
    if (!token) {
      window.location.href = '/therapist-login';
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
      // El backend reemite el token sin el flag mustChangePassword — hay que
      // guardarlo, si no, el próximo /therapist te devuelve acá otra vez.
      if (result.token) saveSession(result.token);
      window.location.href = '/therapist';
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
    <div style={{ minHeight: '100vh', background: 'var(--eph-bg)', padding: '32px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 420, width: '100%', background: 'var(--eph-surface)', border: '1px solid var(--eph-line)', borderRadius: 0, padding: 32 }}>
        <div className="flex justify-center mb-5">
          <Isotipo size={40} />
        </div>
        <h1 className="font-display text-2xl font-normal text-center mb-1.5" style={{ color: 'var(--eph-text)' }}>Crea tu contraseña</h1>
        <p className="font-body text-sm text-center mb-6" style={{ color: 'var(--eph-body)' }}>
          Tu acceso fue creado con una contraseña temporal. Antes de continuar, define una contraseña definitiva.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <div role="alert" className="rounded-none border px-4 py-3 font-body text-sm" style={{ borderColor: 'var(--eph-danger)', background: 'rgba(138,74,60,0.14)', color: 'var(--eph-text)' }}>
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="current-password" className={labelClasses}>Contraseña temporal</label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="La que te dio Alejandro"
              className={inputClasses}
            />
          </div>
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
            {loading ? 'Guardando…' : 'Guardar y continuar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
