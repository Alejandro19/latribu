'use client';

import { useEffect, useState } from 'react';
import { getProtocol, saveProtocol, type SleepProtocol } from '../../lib/sleep-client';
import { fetchClient } from '../../lib/clients-client';
import { isMentoringClient } from '../../lib/rest-logic';
import { showToast } from '../layout/AppShell';
import { RestToolsAdminPanel } from './RestToolsAdminPanel';

const cardStyle: React.CSSProperties = {
  background: 'var(--paper)', border: '1px solid var(--line)',
  borderRadius: 'var(--radius)', padding: '22px 24px', marginBottom: 18,
};
const cardTitleStyle: React.CSSProperties = {
  fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: '0 0 16px',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 4,
};
const fieldStyle: React.CSSProperties = {
  width: '100%', height: 40, borderRadius: 10, border: '1px solid var(--line)',
  padding: '0 10px', fontSize: 13, background: 'var(--paper)', color: 'var(--ink)',
  outline: 'none', boxSizing: 'border-box',
};
const textareaStyle: React.CSSProperties = {
  ...fieldStyle, height: 'auto', minHeight: 120, padding: 10, resize: 'vertical', fontFamily: 'inherit',
};
const primaryButtonStyle: React.CSSProperties = {
  height: 40, padding: '0 22px', borderRadius: 9999, border: 'none',
  background: '#8A5FA0', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
};

export function AdminRestPanel({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mentoring, setMentoring] = useState(false);
  const [protocolText, setProtocolText] = useState('');
  const [supplement, setSupplement] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([getProtocol(clientId).catch(() => null), fetchClient(clientId).catch(() => null)])
      .then(([protocol, client]: [SleepProtocol, { clientType?: string } | null]) => {
        setProtocolText(protocol?.protocolText || '');
        setSupplement(protocol?.supplement || '');
        setMentoring(isMentoringClient(client?.clientType));
      })
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [clientId]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveProtocol(clientId, {
        protocol_text: protocolText || '',
        supplement: supplement || '',
      });
      showToast('Protocolo guardado.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Cargando protocolo de sueño…</p>;

  return (
    <div>
      {mentoring ? (
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Protocolo personalizado</h3>
          <label style={labelStyle} htmlFor="sp-protocol-text">
            Protocolo — una línea por recomendación. Envuelve la acción concreta entre **doble asterisco** para
            resaltarla en morado oscuro; el resto de la línea se muestra en cursiva.
          </label>
          <textarea
            id="sp-protocol-text"
            rows={6}
            style={textareaStyle}
            value={protocolText}
            onChange={(e) => setProtocolText(e.target.value)}
            placeholder={'Ej. **Prioriza tu hora de acostarte** incluso en días de viernes — tu HRV cae los días que duermes menos de 6h30.'}
          />
          <label style={{ ...labelStyle, marginTop: 12 }} htmlFor="sp-supplement">
            Suplemento sugerido (opcional — se omite si queda vacío)
          </label>
          <input id="sp-supplement" style={fieldStyle} placeholder="Ej. Magnesio · 45 min antes de dormir" value={supplement} onChange={(e) => setSupplement(e.target.value)} />
          <button type="button" disabled={saving} style={{ ...primaryButtonStyle, marginTop: 16, opacity: saving ? 0.6 : 1 }} onClick={handleSave}>
            {saving ? 'Guardando…' : 'Guardar protocolo'}
          </button>
        </div>
      ) : (
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Protocolo personalizado</h3>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
            Este cliente no tiene el plan Mentoring — el módulo de Descanso se le muestra bloqueado con un CTA para
            conocer planes. Cambia su tipo de cliente a Mentoring para poder escribirle este protocolo.
          </p>
        </div>
      )}
      <RestToolsAdminPanel />
    </div>
  );
}
