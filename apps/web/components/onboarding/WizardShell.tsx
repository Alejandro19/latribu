'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { computeHiddenFieldIds, validateWizardModule, type WizardFieldConfig } from '@latribu/shared-types';
import { WIZARD_MODULES, WIZARD_MODULE_10, CONDITIONAL_RULES, WIZARD_GROUP_ICON } from '../../lib/wizard-modules';
import { WizardField } from './WizardField';
import { CountryCityPicker, type CountryCityValue } from './CountryCityPicker';
import { Module3, EMPTY_MODULE3_DRAFT, validateModule3, type Module3Draft } from './Module3';
import { Module10, EMPTY_MODULE10_DRAFT, type Module10Draft } from './Module10';
import IdentityHeader from '../ui/IdentityHeader';
import RingProgress from '../ui/RingProgress';
import Button from '../ui/Button';
import { upsertLabPanel } from '../../lib/lab-panels-client';
import {
  putPersonalInfo,
  uploadPersonalInfoFile,
  createAnthropometric,
  createPhoto,
  createInbodyRecord,
  finalizeOnboarding,
  type FinalizeOnboardingMissingItem,
} from '../../lib/onboarding-client';

const MISSING_ITEM_LABELS: Record<FinalizeOnboardingMissingItem, string> = {
  wearable: 'conectar un wearable (o completar los campos de Apple Health)',
  lab_week0: 'cargar tu laboratorio de Semana 0',
  inbody: 'cargar tu InBody',
};

type WizardData = Record<string, string | string[]>;

const PHOTO_ANGLE_KEYS = ['frente', 'lado_derecho', 'lado_izquierdo', 'espalda'] as const;

// Un campo "ancho" (chips, textarea, country-picker, o un select con
// pregunta muy larga) necesita la fila completa — grid-column:1/-1 dentro
// de la rejilla auto-fit de la card (única excepción de ancho permitida,
// spec Prompt 02 §4 regla 5). El resto fluye en una sola rejilla
// auto-fit por card (regla 3): sin emparejamiento manual de a dos, así
// que un grupo con 3 campos ya no deja huecos ni desalinea columnas —
// eso era lo que pasaba antes con groupFieldsIntoRows (removido), que
// armaba filas de a pares en grids de 2 columnas independientes entre sí.
// Como cada campo es su propio ítem de grid (sin agrupar en pares), un
// campo condicional que aparece/desaparece solo agrega o quita SU PROPIO
// ítem — el resto de la card nunca se remonta.
function isWideField(field: WizardFieldConfig): boolean {
  return (
    field.type === 'chips' ||
    field.type === 'textarea' ||
    field.type === 'country-picker' ||
    (field.type === 'select' && field.label.length > 55)
  );
}

// Agrupación temática visual (cards estilo Oura, ver metadata `group` en
// lib/wizard-modules.ts): campos contiguos con el mismo `group` van juntos
// en una sola card. Campos sin `group` (o el módulo entero, ej. Módulo 2 no
// aplica) caen en un grupo `null` que se renderiza sin card envolvente.
function groupFieldsIntoCards(fields: WizardFieldConfig[]): { group: string | null; fields: WizardFieldConfig[] }[] {
  const cards: { group: string | null; fields: WizardFieldConfig[] }[] = [];
  for (const field of fields) {
    const key = field.group ?? null;
    const last = cards[cards.length - 1];
    if (last && last.group === key) {
      last.fields.push(field);
    } else {
      cards.push({ group: key, fields: [field] });
    }
  }
  return cards;
}

export type WizardShellProps = {
  clientId: string;
  variant: 'standard' | 'mentoring';
};

export function WizardShell({ clientId, variant }: WizardShellProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({});
  const [otroValues, setOtroValues] = useState<Record<string, string>>({});
  const [pendingCheckupFile, setPendingCheckupFile] = useState<File | null>(null);
  const [module3Draft, setModule3Draft] = useState<Module3Draft>(EMPTY_MODULE3_DRAFT);
  const [module10Draft, setModule10Draft] = useState<Module10Draft>(EMPTY_MODULE10_DRAFT);
  const [invalidFieldIds, setInvalidFieldIds] = useState<Set<string>>(new Set());
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  // Módulo 10 (Dispositivos y Laboratorios) solo existe para la variante
  // Mentoring — resuelta por la matriz de Roles y Perfiles (ver
  // onboarding/page.tsx), no por un clientType hardcodeado.
  const modules = variant === 'mentoring' ? [...WIZARD_MODULES, WIZARD_MODULE_10] : WIZARD_MODULES;
  const totalModules = modules.length;
  const mod = modules.find((m) => m.n === step)!;
  const hiddenFieldIds = computeHiddenFieldIds(CONDITIONAL_RULES, wizardData, variant);

  // Revalida en vivo SOLO cuando ya hay errores visibles (el usuario intentó
  // avanzar con el paso incompleto) — así un campo deja de verse en rojo en
  // cuanto se completa, en vez de quedar marcado inválido hasta el próximo
  // clic en "Continuar". Sin errores visibles no se toca nada, para no
  // validar de más mientras el usuario recién está llenando el formulario.
  function revalidateWizardData(next: WizardData) {
    if (invalidFieldIds.size === 0) return;
    const nextHidden = computeHiddenFieldIds(CONDITIONAL_RULES, next, variant);
    if (mod.custom === 'country') {
      const invalid: string[] = [];
      if (!next.country) invalid.push('country');
      if (!next.city) invalid.push('city');
      if (!next.phone_number) invalid.push('phone_number');
      invalid.push(...validateWizardModule(mod.fields, next, nextHidden));
      setInvalidFieldIds(new Set(invalid));
      return;
    }
    setInvalidFieldIds(new Set(validateWizardModule(mod.fields, next, nextHidden)));
  }

  function handleFieldChange(id: string, value: string | string[]) {
    const next = { ...wizardData, [id]: value };
    setWizardData(next);
    revalidateWizardData(next);
  }

  function handleOtroChange(id: string, value: string) {
    setOtroValues((prev) => ({ ...prev, [id]: value }));
  }

  function handleFileChange(id: string, file: File | null) {
    if (id === 'checkup_file') setPendingCheckupFile(file);
    const next = { ...wizardData, [id]: file?.name || '' };
    setWizardData(next);
    revalidateWizardData(next);
  }

  function handleCountryCityChange(patch: Partial<CountryCityValue>) {
    const next = {
      ...wizardData,
      ...(patch.country !== undefined ? { country: patch.country } : {}),
      ...(patch.city !== undefined ? { city: patch.city } : {}),
      ...(patch.phoneCode !== undefined ? { phone_code: patch.phoneCode } : {}),
      ...(patch.phoneNumber !== undefined ? { phone_number: patch.phoneNumber } : {}),
    };
    setWizardData(next);
    revalidateWizardData(next);
  }

  function handleModule3Change(next: Module3Draft) {
    setModule3Draft(next);
    if (invalidFieldIds.size > 0) {
      setInvalidFieldIds(new Set(validateModule3(next)));
    }
  }

  async function finalize() {
    setFinalizing(true);
    setFinalizeError(null);
    try {
      let onboardingReport: Record<string, unknown> = { ...wizardData };
      for (const [fieldId, otro] of Object.entries(otroValues)) {
        onboardingReport[`${fieldId}_otro`] = otro;
      }
      if (pendingCheckupFile) {
        const uploaded = await uploadPersonalInfoFile(clientId, pendingCheckupFile, onboardingReport);
        onboardingReport = {
          ...onboardingReport,
          checkup_file_url: uploaded.file_url,
          checkup_file_name: uploaded.file_name,
          checkup_uploaded_at: uploaded.uploaded_at,
        };
      }

      // apple_health_connected es la única señal server-side de "wearable
      // conectado" para Apple Watch (sin OAuth real) — se exige completo
      // (los 4 campos) para contar, mismo criterio que Module3 exige la
      // mayoría de los campos InBody antes de aceptar ese registro.
      const appleHealthConnected =
        module10Draft.wearable === 'Apple Watch' &&
        !!module10Draft.appleHealth.hrv &&
        !!module10Draft.appleHealth.fcReposo &&
        !!module10Draft.appleHealth.spo2 &&
        !!module10Draft.appleHealth.vo2max;

      // `complete: true` se pide al final, en finalizeOnboarding() — recién
      // ahí, tras guardar InBody y laboratorio semana 0, el backend puede
      // validar que Mentoría tenga los 3 elementos obligatorios completos.
      await putPersonalInfo(clientId, {
        name: wizardData.name as string,
        age: wizardData.age ? Number(wizardData.age) : null,
        birthdate: wizardData.birthdate as string,
        gender: wizardData.gender as string,
        occupation: wizardData.occupation as string,
        cedula: wizardData.cedula as string,
        id_type: wizardData.id_type as string,
        email: wizardData.email as string,
        marital_status: wizardData.marital_status as string,
        country: wizardData.country as string,
        city: wizardData.city as string,
        phone_code: wizardData.phone_code as string,
        phone_number: wizardData.phone_number as string,
        weight: module3Draft.inbody.pesoTotal ? Number(module3Draft.inbody.pesoTotal) : null,
        height: module3Draft.inbody.altura ? Number(module3Draft.inbody.altura) : null,
        body_fat: module3Draft.inbody.grasaPct ? Number(module3Draft.inbody.grasaPct) : null,
        hormonal_status: wizardData.hormonal_status as string,
        hormonal_status_other: wizardData.hormonal_status_other as string,
        last_period_date: wizardData.last_period_date as string,
        cycle_length_days: wizardData.cycle_length_days ? Number(wizardData.cycle_length_days) : null,
        snores: wizardData.snores as string,
        sleep_apnea_signs: wizardData.sleep_apnea_signs as string,
        onboarding_report: onboardingReport,
        apple_health_connected: appleHealthConnected,
      });

      const monthNum = 1; // primer registro del onboarding — siempre mes 1
      const { cintura, brazos, hombros, piernas, gluteo } = module3Draft.antropometria;
      if (cintura || brazos || hombros || piernas || gluteo) {
        await createAnthropometric(clientId, {
          fecha: new Date().toISOString().slice(0, 10),
          peso: module3Draft.inbody.pesoTotal ? Number(module3Draft.inbody.pesoTotal) : null,
          cintura: cintura ? Number(cintura) : null,
          brazos: brazos ? Number(brazos) : null,
          hombros: hombros ? Number(hombros) : null,
          piernas: piernas ? Number(piernas) : null,
          gluteo: gluteo ? Number(gluteo) : null,
          mes_num: monthNum,
        });
      }

      for (const angle of PHOTO_ANGLE_KEYS) {
        const file = module3Draft.photos[angle];
        if (file) await createPhoto(clientId, file, angle, monthNum);
      }

      if (module3Draft.inbody.ocrDone && module3Draft.inbody.pesoTotal) {
        await createInbodyRecord(clientId, {
          fecha: new Date().toISOString().slice(0, 10),
          version: module3Draft.inbody.version,
          peso_total: Number(module3Draft.inbody.pesoTotal),
          smm: module3Draft.inbody.smm ? Number(module3Draft.inbody.smm) : null,
          grasa_pct: module3Draft.inbody.grasaPct ? Number(module3Draft.inbody.grasaPct) : null,
          imc: module3Draft.inbody.imc ? Number(module3Draft.inbody.imc) : null,
          peso_objetivo: module3Draft.inbody.pesoObjetivo ? Number(module3Draft.inbody.pesoObjetivo) : null,
          grasa_visceral: module3Draft.inbody.grasaVisceral ? Number(module3Draft.inbody.grasaVisceral) : null,
          bmr: module3Draft.inbody.bmr ? Number(module3Draft.inbody.bmr) : null,
          angulo_fase: module3Draft.inbody.anguloFase ? Number(module3Draft.inbody.anguloFase) : null,
          ecw_tbw: module3Draft.inbody.ecwTbw ? Number(module3Draft.inbody.ecwTbw) : null,
          masa_osea: module3Draft.inbody.masaOsea ? Number(module3Draft.inbody.masaOsea) : null,
          altura: module3Draft.inbody.altura ? Number(module3Draft.inbody.altura) : null,
          mes_num: monthNum,
          file_url: module3Draft.inbody.fileUrl,
          file_name: module3Draft.inbody.fileName,
        });
      }

      if (variant === 'mentoring') {
        onboardingReport.m10_wearable = module10Draft.wearable;
        onboardingReport.m10_aw_hrv = module10Draft.appleHealth.hrv;
        onboardingReport.m10_aw_fc_reposo = module10Draft.appleHealth.fcReposo;
        onboardingReport.m10_aw_spo2 = module10Draft.appleHealth.spo2;
        onboardingReport.m10_aw_vo2max = module10Draft.appleHealth.vo2max;

        const labDatos = module10Draft.labMarkers.reduce<Record<string, number>>((acc, m) => {
          if (m.detected && m.value != null) acc[m.marker_id] = m.value;
          return acc;
        }, {});
        if (Object.keys(labDatos).length > 0) {
          await upsertLabPanel(clientId, {
            semana: module10Draft.labSemana,
            fecha: module10Draft.labFecha,
            datos: labDatos,
            diaCicloPanel: module10Draft.labDiaCiclo ? Number(module10Draft.labDiaCiclo) : null,
            fileUrl: module10Draft.labFileUrl ?? undefined,
            fileName: module10Draft.labFileName ?? undefined,
            sourceFileHash: module10Draft.labSourceFileHash ?? undefined,
          });
        }
      }

      const result = await finalizeOnboarding(clientId);
      if (!result.success) {
        const missingLabels = (result.missing ?? []).map((m) => MISSING_ITEM_LABELS[m]);
        setFinalizeError(
          missingLabels.length > 0
            ? `Antes de terminar, necesitas ${missingLabels.join(', ')}.`
            : result.error || 'No se pudo completar el onboarding.'
        );
        return;
      }
      setComplete(true);
    } catch (e) {
      setFinalizeError(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setFinalizing(false);
    }
  }

  function handleContinue() {
    if (mod.custom === 'country') {
      const invalid: string[] = [];
      if (!wizardData.country) invalid.push('country');
      if (!wizardData.city) invalid.push('city');
      if (!wizardData.phone_number) invalid.push('phone_number');
      invalid.push(...validateWizardModule(mod.fields, wizardData, hiddenFieldIds));
      setInvalidFieldIds(new Set(invalid));
      if (invalid.length > 0) return;
      setStep(2);
      return;
    }
    if (mod.custom === 'body') {
      const invalid = validateModule3(module3Draft);
      setInvalidFieldIds(new Set(invalid));
      if (invalid.length > 0) return;
      setStep(4);
      return;
    }
    const invalid = validateWizardModule(mod.fields, wizardData, hiddenFieldIds);
    setInvalidFieldIds(new Set(invalid));
    if (invalid.length > 0) return;
    if (step < totalModules) {
      setStep(step + 1);
      return;
    }
    void finalize();
  }

  if (complete) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        {/* Tarjeta estilo notificación push (icono + nombre de app + "ahora"),
            en vez del check genérico centrado — pedido explícito del usuario. */}
        <div className="w-full max-w-sm border p-4" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center text-lg" style={{ background: 'rgba(201,164,106,.16)', color: 'var(--eph-accent)' }}>
              ✓
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="m-0 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--eph-muted)' }}>Ephirox</p>
                <p className="m-0 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--eph-muted)' }}>ahora</p>
              </div>
              <p className="m-0 mt-1 font-display text-lg" style={{ color: 'var(--eph-text)' }}>Listo.</p>
              <p className="m-0 mt-1 font-body text-sm leading-snug" style={{ color: 'var(--eph-body)' }}>
                {variant === 'mentoring'
                  ? 'Datos guardados. Tu programa arranca oficialmente en Semana 1 una vez que el equipo confirme tus datos de laboratorio, wearable y baseline.'
                  : 'Datos guardados. Tu coach te contactará lo antes posible.'}
              </p>
            </div>
          </div>
          <Button type="button" variant="primary" onClick={() => router.push('/training')} className="mt-4 w-full">
            Aceptar
          </Button>
        </div>
      </div>
    );
  }

  const formPct = Math.round((step / totalModules) * 100);

  return (
    <div>
      <IdentityHeader
        title="Baseline"
        subtitle="El punto de partida exacto. Cada dato aquí calibra tu protocolo de optimización."
      />

      {/* Progreso del formulario — sin bloque de color, RingProgress como único acento */}
      <div className="mb-6 flex items-center justify-between gap-5 border-t pt-5" style={{ borderColor: 'var(--eph-line)' }}>
        <div className="flex-1">
          <p className="m-0 mb-2.5 font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: 'var(--eph-accent)' }}>
            Módulo {step} de {totalModules}
          </p>
          <p className="m-0 mb-1 font-display text-[22px]" style={{ color: 'var(--eph-text)' }}>{mod.title}</p>
          <p className="m-0 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--eph-muted)' }}>{formPct}% de tu formulario completado</p>
        </div>
        <RingProgress value={formPct} size={70} strokeWidth={6} />
      </div>

      {/* Punticos de módulo */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {modules.map((m) => {
          const done = m.n < step;
          const current = m.n === step;
          return (
            <button
              key={m.n}
              type="button"
              onClick={() => setStep(m.n)}
              aria-current={current ? 'step' : undefined}
              aria-label={`Ir al módulo ${m.n}: ${m.title}`}
              className="flex h-8 w-8 items-center justify-center rounded-full border font-mono text-[12px] transition-colors"
              style={{
                background: current ? "var(--eph-accent)" : "transparent",
                borderColor: current || done ? "var(--eph-accent)" : "var(--eph-line)",
                color: current ? "var(--eph-ink)" : done ? "var(--eph-accent)" : "var(--eph-faint)",
              }}
            >
              {m.n}
            </button>
          );
        })}
      </div>

      {/* Módulo actual — sección abierta, sin fondo de color propio */}
      <div className="border-t py-6" style={{ borderColor: 'var(--eph-line)' }}>
        <h2 className="m-0 mb-4 font-display text-xl" style={{ color: 'var(--eph-text)' }}>
          Módulo {mod.n} · {mod.title}
        </h2>

        <div className="grid" style={{ gap: 24 }}>
          {groupFieldsIntoCards(mod.fields).map((card) => {
            const visibleFields = card.fields.filter((f) => !hiddenFieldIds.has(f.id));
            if (visibleFields.length === 0) return null;
            const GroupIcon = card.group ? WIZARD_GROUP_ICON[card.group] : undefined;
            // Una sola rejilla auto-fit por card (spec §4 regla 3): nada de
            // emparejar campos de a dos en grids de 2 columnas separados —
            // eso es lo que desalineaba las columnas entre filas y dejaba
            // huecos cuando un grupo tenía un número impar de campos. Un
            // campo ancho (isWideField) ocupa la fila completa vía
            // grid-column:1/-1 (regla 5, única excepción permitida).
            const fieldsGrid = (
              <div
                className="grid"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '30px clamp(28px, 4vw, 56px)' }}
              >
                {visibleFields.map((field) => (
                  <div key={field.id} style={isWideField(field) ? { gridColumn: '1 / -1' } : undefined}>
                    {field.type === 'country-picker' ? (
                      <CountryCityPicker
                        value={{
                          country: (wizardData.country as string) || '',
                          city: (wizardData.city as string) || '',
                          phoneCode: (wizardData.phone_code as string) || '+57',
                          phoneNumber: (wizardData.phone_number as string) || '',
                        }}
                        onChange={handleCountryCityChange}
                        invalidFieldIds={invalidFieldIds}
                      />
                    ) : (
                      <WizardField
                        field={field}
                        value={wizardData[field.id]}
                        otroValue={otroValues[field.id]}
                        invalid={invalidFieldIds.has(field.id)}
                        onChange={handleFieldChange}
                        onOtroChange={handleOtroChange}
                        onFileChange={handleFileChange}
                      />
                    )}
                  </div>
                ))}
              </div>
            );
            if (!card.group) return <div key={card.fields[0].id}>{fieldsGrid}</div>;
            return (
              <div
                key={card.fields[0].id}
                className="border"
                style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)', boxShadow: 'var(--eph-shadow)', padding: 'clamp(26px, 3vw, 38px)' }}
              >
                <div
                  className="flex items-center gap-2"
                  style={{ paddingBottom: 26, borderBottom: '1px solid var(--eph-line)' }}
                >
                  {GroupIcon && <GroupIcon size={16} style={{ color: 'var(--eph-accent)' }} />}
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.22em]"
                    style={{ color: 'var(--eph-accent)' }}
                  >
                    {card.group}
                  </span>
                </div>
                <div style={{ paddingTop: 28 }}>{fieldsGrid}</div>
              </div>
            );
          })}
        </div>

        {mod.custom === 'body' && (
          <div className="mt-4">
            <Module3 clientId={clientId} draft={module3Draft} onChange={handleModule3Change} invalidFields={invalidFieldIds} />
          </div>
        )}

        {mod.custom === 'devices' && (
          <div className="mt-4">
            <Module10
              clientId={clientId}
              draft={module10Draft}
              onChange={setModule10Draft}
              hormonalStatus={(wizardData.hormonal_status as string) ?? null}
              lastPeriodDate={(wizardData.last_period_date as string) ?? null}
              cycleLengthDays={wizardData.cycle_length_days ? Number(wizardData.cycle_length_days) : null}
            />
          </div>
        )}

        {finalizeError && (
          <p role="alert" className="mt-4 border px-4 py-3 font-body text-sm" style={{ borderColor: 'var(--eph-danger)', background: 'rgba(138,74,60,.14)', color: 'var(--eph-text)' }}>
            {finalizeError}
          </p>
        )}

        <div className="mt-6 flex justify-between">
          <Button
            type="button"
            variant="secondary"
            disabled={step === 1}
            onClick={() => setStep(step - 1)}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={finalizing}
            onClick={handleContinue}
          >
            {finalizing ? 'Guardando…' : step === totalModules ? 'Finalizar' : 'Continuar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
