'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { getProtocol, saveProtocol } from '../../lib/sleep-client';
import { fetchClient } from '../../lib/clients-client';
import { isMentoringClient } from '../../lib/rest-logic';
import { showToast } from '../layout/AppShell';
import { RestToolsAdminPanel } from './RestToolsAdminPanel';
import { InsightsSection } from '../insights/InsightsSection';

const cardStyle: React.CSSProperties = {
  background: 'var(--eph-surface)', border: '1px solid var(--eph-line)',
  borderRadius: '0', padding: '22px 24px', marginBottom: 20,
};
const cardTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 18, fontWeight: 400, color: 'var(--eph-text)', margin: '0 0 16px',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace', fontSize: 10,
  textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 400, color: 'var(--eph-muted)', marginBottom: 6,
};
const fieldStyle: React.CSSProperties = {
  width: '100%', height: 32, borderRadius: 0, border: 'none', borderBottom: '1px solid var(--eph-line-2)',
  padding: '0 2px 6px', fontSize: 15, fontWeight: 400, background: 'transparent', color: 'var(--eph-text)',
  outline: 'none', boxSizing: 'border-box',
};
const textareaStyle: React.CSSProperties = {
  width: '100%', borderRadius: 0, border: '1px solid var(--eph-line)',
  padding: 10, fontSize: 15, fontWeight: 400, background: 'var(--eph-surface)', color: 'var(--eph-text)',
  outline: 'none', boxSizing: 'border-box', minHeight: 120, resize: 'vertical', fontFamily: 'inherit',
};
const primaryButtonStyle: React.CSSProperties = {
  height: 40, padding: '0 22px', borderRadius: 0, border: 'none',
  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
  background: 'var(--eph-accent)', color: 'var(--eph-ink)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', cursor: 'pointer',
};

export function AdminRestPanel({ clientId }: { clientId: string }) {
  const { data, error: loadError, isLoading: loading } = useSWR(['rest-admin-protocol', clientId], async () => {
    const [protocol, client] = await Promise.all([getProtocol(clientId).catch(() => null), fetchClient(clientId).catch(() => null)]);
    return { protocol, mentoring: isMentoringClient(client?.clientType) };
  });
  const [saving, setSaving] = useState(false);
  const [protocolText, setProtocolText] = useState('');
  const [supplement, setSupplement] = useState('');

  useEffect(() => {
    if (data) {
      setProtocolText(data.protocol?.protocolText || '');
      setSupplement(data.protocol?.supplement || '');
    }
  }, [data]);

  useEffect(() => {
    if (loadError) showToast((loadError as Error).message, 'error');
  }, [loadError]);

  const mentoring = data?.mentoring ?? false;

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

  if (loading) return <p style={{ color: 'var(--eph-muted)', fontSize: 14 }}>Cargando protocolo de sueño…</p>;

  return (
    <div>
      {mentoring && <InsightsSection clientId={clientId} moduleKey="sueno" />}
      {mentoring ? (
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Protocolo personalizado</h3>
          <label style={labelStyle} htmlFor="sp-protocol-text">
            Protocolo — una línea por recomendación. Envuelve la acción concreta entre **doble asterisco** para
            resaltarla en negrita; el resto de la línea se muestra en cursiva.
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
          <p style={{ fontSize: 13, color: 'var(--eph-muted)', margin: 0 }}>
            Este cliente no tiene el plan Premium — el módulo Sleep se le muestra bloqueado con un CTA para
            conocer planes. Cambia su tipo de cliente a Premium para poder escribirle este protocolo.
          </p>
        </div>
      )}
      <RestToolsAdminPanel />
    </div>
  );
}
