'use client';

import { useEffect, useState } from 'react';
import type { WizardFieldConfig } from '@latribu/shared-types';
import { WIZARD_MODULES, WIZARD_MODULE_10 } from '../../lib/wizard-modules';
import type { PersonalInfo } from '../../lib/personal-info-client';
import { getPhotos, type ProgressPhoto } from '../../lib/personal-info-client';
import { getEvolutionData, type AnthropometricRecord, type InbodyRecord } from '../../lib/evolution-client';
import Accordion from '../ui/Accordion';

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--eph-muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
};
const valueStyle: React.CSSProperties = { margin: 0, fontSize: 13.5, color: 'var(--eph-text)', lineHeight: 1.4 };

function calculateAge(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const b = new Date(`${birthdate}T00:00:00`);
  if (isNaN(b.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

// Cada respuesta libre "Otra/Otro" guarda su detalle en `${fieldId}_otro`
// dentro de onboarding_report — ver CONDITIONAL_RULES en wizard-modules.ts.
function formatFieldValue(field: WizardFieldConfig, report: Record<string, unknown>): string | null {
  const raw = report[field.id];
  if (raw === undefined || raw === null || raw === '') return null;
  let display = Array.isArray(raw) ? raw.filter(Boolean).join(', ') : String(raw);
  if (!display) return null;
  const otro = report[`${field.id}_otro`];
  if (typeof otro === 'string' && otro.trim()) display += ` (${otro.trim()})`;
  return display;
}

function buildGenericRows(fields: WizardFieldConfig[], report: Record<string, unknown>): [string, React.ReactNode][] {
  return fields.map((field) => {
    if (field.id === 'checkup_file' && typeof report.checkup_file_url === 'string' && report.checkup_file_url) {
      return [
        field.label,
        <a key="link" href={report.checkup_file_url as string} target="_blank" rel="noreferrer" style={{ color: 'var(--eph-accent)', textDecoration: 'underline' }}>
          {(report.checkup_file_name as string) || 'Ver archivo'}
        </a>,
      ];
    }
    return [field.label, formatFieldValue(field, report)];
  });
}

function FieldGrid({ rows }: { rows: [string, React.ReactNode][] }) {
  const visible = rows.filter(([, v]) => v !== null && v !== undefined);
  if (visible.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--eph-muted)', margin: 0 }}>Sin respuestas registradas en este módulo.</p>;
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
      {visible.map(([label, value], i) => (
        <div key={`${label}-${i}`}>
          <span style={labelStyle}>{label}</span>
          <p style={valueStyle}>{value}</p>
        </div>
      ))}
    </div>
  );
}

const subheadStyle: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 700, color: 'var(--eph-text)', margin: '18px 0 8px',
};
const rowStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: '4px 18px', padding: '8px 0',
  borderBottom: '1px solid var(--eph-line)', fontSize: 12.5, color: 'var(--eph-text)',
};

function fmt(value: number | string | null | undefined, suffix = ''): string {
  return value === null || value === undefined || value === '' ? '—' : `${value}${suffix}`;
}

// Medidas, InBody y fotos de progreso viven en el módulo "Mi Evolución"
// (mismos endpoints que ClientEvolutionPanel/AdminEvolutionPanel) — este
// bloque los trae de solo lectura para que el admin no tenga que saltar de
// pantalla al revisar el resumen de onboarding de un cliente.
function BodyComposition({ clientId }: { clientId: string }) {
  const [anthropometrics, setAnthropometrics] = useState<AnthropometricRecord[]>([]);
  const [inbody, setInbody] = useState<InbodyRecord[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getEvolutionData(clientId), getPhotos(clientId).catch(() => [])])
      .then(([evo, photoList]) => {
        if (cancelled) return;
        setAnthropometrics(evo.anthropometrics);
        setInbody(evo.inbody);
        setPhotos(photoList);
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientId]);

  if (loading) return <p style={{ fontSize: 12.5, color: 'var(--eph-muted)', marginTop: 14 }}>Cargando medidas, InBody y fotos…</p>;
  if (error) return <p style={{ fontSize: 12.5, color: '#D99483', marginTop: 14 }}>{error}</p>;

  return (
    <div>
      <p style={subheadStyle}>Medidas registradas ({anthropometrics.length})</p>
      {anthropometrics.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--eph-muted)', margin: 0 }}>Sin medidas registradas.</p>
      ) : (
        anthropometrics.map((a) => (
          <div key={a.id} style={rowStyle}>
            <span style={{ fontWeight: 700, minWidth: 90 }}>{a.fecha}</span>
            <span>Peso: {fmt(a.peso, ' kg')}</span>
            <span>Cintura: {fmt(a.cintura, ' cm')}</span>
            <span>Brazos: {fmt(a.brazos, ' cm')}</span>
            <span>Hombros: {fmt(a.hombros, ' cm')}</span>
            <span>Piernas: {fmt(a.piernas, ' cm')}</span>
            <span>Glúteo: {fmt(a.gluteo, ' cm')}</span>
          </div>
        ))
      )}

      <p style={subheadStyle}>Registros InBody ({inbody.length})</p>
      {inbody.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--eph-muted)', margin: 0 }}>Sin registros InBody.</p>
      ) : (
        inbody.map((r) => (
          <div key={r.id} style={rowStyle}>
            <span style={{ fontWeight: 700, minWidth: 90 }}>{r.fecha ?? '—'}</span>
            <span>Talla: {fmt(r.altura, ' cm')}</span>
            <span>Peso: {fmt(r.pesoTotal, ' kg')}</span>
            <span>Peso ideal: {fmt(r.pesoObjetivo, ' kg')}</span>
            <span>SMM: {fmt(r.smm, ' kg')}</span>
            <span>Masa ósea: {fmt(r.masaOsea, ' kg')}</span>
            <span>% Grasa: {fmt(r.grasaPct, '%')}</span>
            <span>IMC: {fmt(r.imc)}</span>
            <span>Grasa visceral: {fmt(r.grasaVisceral)}</span>
            <span>Agua corporal (ECW/TBW): {fmt(r.ecwTbw)}</span>
            <span>BMR: {fmt(r.bmr, ' kcal')}</span>
            {r.fileUrl && (
              <a href={r.fileUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--eph-accent)', fontWeight: 600, textDecoration: 'underline' }}>
                Ver archivo
              </a>
            )}
          </div>
        ))
      )}

      <p style={subheadStyle}>Fotos de progreso ({photos.length})</p>
      {photos.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--eph-muted)', margin: 0 }}>Sin fotos registradas.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {photos.map((p) => (
            <a key={p.id} href={p.photoUrl} target="_blank" rel="noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
              <img
                src={p.photoUrl}
                alt={`${p.angle ?? 'Foto'} · ${p.fecha}`}
                style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--eph-line)' }}
              />
              <span style={{ display: 'block', marginTop: 3, fontSize: 10.5, color: 'var(--eph-muted)', textAlign: 'center' }}>
                {p.angle ?? '—'} · {p.fecha}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleHeader({ n, title }: { n: number; title: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(201,166,107,.14)', color: 'var(--eph-accent)',
          fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {n}
      </span>
      {title}
    </span>
  );
}

export function OnboardingSummaryAccordion({
  personalInfo,
  clientType,
  clientId,
}: {
  personalInfo: PersonalInfo | null;
  clientType: string | null;
  clientId: string;
}) {
  if (!personalInfo || !personalInfo.completedAt) {
    return <p style={{ color: 'var(--eph-muted)', fontSize: 13 }}>Este cliente aún no completó el formulario de onboarding.</p>;
  }

  const report = (personalInfo.onboardingReport ?? {}) as Record<string, unknown>;

  const module1Rows: [string, React.ReactNode][] = [
    ['Nombre completo', personalInfo.name],
    ['Tipo de identificación', personalInfo.idType],
    ['Número de identificación', personalInfo.cedula],
    ['Género', personalInfo.gender],
    ['Edad declarada', personalInfo.age?.toString() ?? null],
    ['Edad calculada', calculateAge(personalInfo.birthdate)?.toString() ?? null],
    ['Fecha de nacimiento', personalInfo.birthdate],
    ['Correo electrónico', personalInfo.email],
    ['País', personalInfo.country],
    ['Ciudad', personalInfo.city],
    ['Celular', personalInfo.phoneNumber ? `${personalInfo.phoneCode ?? ''} ${personalInfo.phoneNumber}`.trim() : null],
    ['Ocupación', personalInfo.occupation],
    ['Estado civil', personalInfo.maritalStatus],
  ];

  const module3Content = (
    <div>
      <FieldGrid
        rows={[
          ['Peso', personalInfo.weight != null ? `${personalInfo.weight} kg` : null],
          ['Estatura', personalInfo.height != null ? `${personalInfo.height} cm` : null],
          ['% Grasa corporal', personalInfo.bodyFat != null ? `${personalInfo.bodyFat}%` : null],
        ]}
      />
      <BodyComposition clientId={clientId} />
    </div>
  );

  const items = WIZARD_MODULES.map((m) => {
    if (m.n === 1) return { header: <ModuleHeader n={1} title={m.title} />, content: <FieldGrid rows={module1Rows} /> };
    if (m.n === 3) return { header: <ModuleHeader n={3} title={m.title} />, content: module3Content };
    return { header: <ModuleHeader n={m.n} title={m.title} />, content: <FieldGrid rows={buildGenericRows(m.fields, report)} /> };
  });

  if (clientType === 'mentoring') {
    items.push({
      header: <ModuleHeader n={WIZARD_MODULE_10.n} title={WIZARD_MODULE_10.title} />,
      content: (
        <div>
          <FieldGrid
            rows={[
              ['Dispositivo wearable', (report.m10_wearable as string) || null],
              ['HRV (Apple Health)', (report.m10_aw_hrv as string) || null],
              ['FC en reposo (Apple Health)', (report.m10_aw_fc_reposo as string) || null],
              ['SpO2 (Apple Health)', (report.m10_aw_spo2 as string) || null],
              ['VO2 max (Apple Health)', (report.m10_aw_vo2max as string) || null],
            ]}
          />
          <p style={{ marginTop: 12, fontSize: 12, color: 'var(--eph-muted)' }}>
            Los paneles de laboratorio (semana 0/6/12) se gestionan en su propio panel, no aquí.
          </p>
        </div>
      ),
    });
  }

  return <Accordion items={items} />;
}
