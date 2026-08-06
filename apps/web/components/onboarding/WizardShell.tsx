'use client';

import { useState } from 'react';
import { computeHiddenFieldIds, validateWizardModule } from '@latribu/shared-types';
import { WIZARD_MODULES, WIZARD_MODULE_10, CONDITIONAL_RULES } from '../../lib/wizard-modules';
import { WizardField } from './WizardField';
import { CountryCityPicker, type CountryCityValue } from './CountryCityPicker';
import { Module3, EMPTY_MODULE3_DRAFT, validateModule3, type Module3Draft } from './Module3';
import { Module10, EMPTY_MODULE10_DRAFT, type Module10Draft } from './Module10';
import IdentityHeader from '../ui/IdentityHeader';
import { upsertLabPanel } from '../../lib/lab-panels-client';
import {
  putPersonalInfo,
  uploadPersonalInfoFile,
  createAnthropometric,
  createPhoto,
  createInbodyRecord,
} from '../../lib/onboarding-client';

type WizardData = Record<string, string | string[]>;

const PHOTO_ANGLE_KEYS = ['frente', 'lado_derecho', 'lado_izquierdo', 'espalda'] as const;

export type WizardShellProps = {
  clientId: string;
  clientType?: string | null;
};

export function WizardShell({ clientId, clientType }: WizardShellProps) {
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

  // Módulo 10 (Dispositivos y Laboratorios) solo existe para clientes tipo
  // Mentoring — el resto sigue viendo exactamente los 9 módulos de siempre.
  const modules = clientType === 'mentoring' ? [...WIZARD_MODULES, WIZARD_MODULE_10] : WIZARD_MODULES;
  const totalModules = modules.length;
  const mod = modules.find((m) => m.n === step)!;
  const hiddenFieldIds = computeHiddenFieldIds(CONDITIONAL_RULES, wizardData);

  function handleFieldChange(id: string, value: string | string[]) {
    setWizardData((prev) => ({ ...prev, [id]: value }));
  }

  function handleOtroChange(id: string, value: string) {
    setOtroValues((prev) => ({ ...prev, [id]: value }));
  }

  function handleFileChange(id: string, file: File | null) {
    if (id === 'checkup_file') setPendingCheckupFile(file);
    setWizardData((prev) => ({ ...prev, [id]: file?.name || '' }));
  }

  function handleCountryCityChange(patch: Partial<CountryCityValue>) {
    setWizardData((prev) => ({
      ...prev,
      ...(patch.country !== undefined ? { country: patch.country } : {}),
      ...(patch.city !== undefined ? { city: patch.city } : {}),
      ...(patch.phoneCode !== undefined ? { phone_code: patch.phoneCode } : {}),
      ...(patch.phoneNumber !== undefined ? { phone_number: patch.phoneNumber } : {}),
    }));
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

      await putPersonalInfo(clientId, {
        birthdate: wizardData.birthdate as string,
        gender: wizardData.gender as string,
        occupation: wizardData.occupation as string,
        marital_status: wizardData.marital_status as string,
        country: wizardData.country as string,
        city: wizardData.city as string,
        phone_code: wizardData.phone_code as string,
        phone_number: wizardData.phone_number as string,
        weight: module3Draft.weight ? Number(module3Draft.weight) : null,
        height: module3Draft.height ? Number(module3Draft.height) : null,
        body_fat: module3Draft.bodyFat ? Number(module3Draft.bodyFat) : null,
        onboarding_report: onboardingReport,
        complete: true,
      });

      const monthNum = 1; // primer registro del onboarding — siempre mes 1
      const { cintura, brazos, hombros, piernas, gluteo } = module3Draft.antropometria;
      if (cintura || brazos || hombros || piernas || gluteo) {
        await createAnthropometric(clientId, {
          fecha: new Date().toISOString().slice(0, 10),
          peso: module3Draft.weight ? Number(module3Draft.weight) : null,
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

      if (clientType === 'mentoring') {
        onboardingReport.m10_wearable = module10Draft.wearable;
        onboardingReport.m10_aw_hrv = module10Draft.appleHealth.hrv;
        onboardingReport.m10_aw_fc_reposo = module10Draft.appleHealth.fcReposo;
        onboardingReport.m10_aw_spo2 = module10Draft.appleHealth.spo2;
        onboardingReport.m10_aw_vo2max = module10Draft.appleHealth.vo2max;

        const labDatos = Object.entries(module10Draft.labDatos).reduce<Record<string, number>>((acc, [k, v]) => {
          if (v) acc[k] = Number(v);
          return acc;
        }, {});
        if (Object.keys(labDatos).length > 0) {
          await upsertLabPanel(clientId, { semana: module10Draft.labSemana, fecha: module10Draft.labFecha, datos: labDatos });
        }
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
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--sage-soft)] text-3xl text-[var(--sage)]">
          ✓
        </div>
        <h1 className="mb-2 font-serif text-2xl font-bold text-[var(--ink)]">¡Listo!</h1>
        <p className="max-w-sm text-sm text-[var(--ink-soft)]">
          Datos guardados. Tu coach te contactará lo antes posible.
        </p>
      </div>
    );
  }

  const formPct = Math.round((step / totalModules) * 100);
  const ringR = 30;
  const ringCirc = 2 * Math.PI * ringR;
  const ringFilled = (formPct / 100) * ringCirc;

  return (
    <div>
      <IdentityHeader
        title="Información Personal"
        subtitle="Conocerte nos permite diseñar tu experiencia dentro de La Tribu."
      />

      {/* Hero: progreso del formulario */}
      <div
        className="relative mb-6 overflow-hidden rounded-[20px] p-7 text-white"
        style={{ background: "linear-gradient(135deg, #2B2621, #3A322A)" }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,.16) 0%, transparent 70%)" }}
        />
        <div className="relative z-10 flex items-center justify-between gap-5">
          <div className="relative h-[70px] w-[70px] flex-shrink-0">
            <svg viewBox="0 0 70 70" width="70" height="70" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="35" cy="35" r={ringR} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="6" />
              <circle
                cx="35" cy="35" r={ringR} fill="none" stroke="var(--gold)" strokeWidth="6"
                strokeLinecap="round" strokeDasharray={`${ringFilled.toFixed(1)} ${ringCirc.toFixed(1)}`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
              {formPct}%
            </div>
          </div>
          <div className="flex-1">
            <p className="m-0 mb-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">
              Módulo {step} de {totalModules}
            </p>
            <p className="m-0 mb-1 font-serif text-[21px] font-semibold">{mod.title}</p>
            <p className="m-0 text-[13px] opacity-75">{formPct}% de tu formulario completado</p>
          </div>
        </div>
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
              className="flex h-8 w-8 items-center justify-center rounded-full border text-[13px] font-bold transition-colors"
              style={{
                background: current ? "var(--gold)" : done ? "var(--sage)" : "var(--cream)",
                borderColor: current ? "var(--gold)" : done ? "var(--sage)" : "var(--line)",
                color: current || done ? "#fff" : "var(--ink-soft)",
              }}
            >
              {m.n}
            </button>
          );
        })}
      </div>

      {/* Card del módulo actual */}
      <div className="mb-5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-6">
        <h2 className="m-0 mb-4 text-lg font-bold text-[var(--ink)]">
          Módulo {mod.n} · {mod.title}
        </h2>

        {mod.custom === 'country' && (
          <div className="mb-4">
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
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {mod.fields.map((field) => (
            <WizardField
              key={field.id}
              field={field}
              value={wizardData[field.id]}
              otroValue={otroValues[field.id]}
              hidden={hiddenFieldIds.has(field.id)}
              invalid={invalidFieldIds.has(field.id)}
              onChange={handleFieldChange}
              onOtroChange={handleOtroChange}
              onFileChange={handleFileChange}
            />
          ))}
        </div>

        {mod.custom === 'body' && (
          <div className="mt-4">
            <Module3 clientId={clientId} draft={module3Draft} onChange={setModule3Draft} invalidFields={invalidFieldIds} />
          </div>
        )}

        {mod.custom === 'devices' && (
          <div className="mt-4">
            <Module10 clientId={clientId} draft={module10Draft} onChange={setModule10Draft} />
          </div>
        )}

        {finalizeError && (
          <p role="alert" className="mt-4 rounded-xl border border-[var(--danger)] bg-[var(--terracota-soft)] px-4 py-3 text-sm text-[var(--danger)]">
            {finalizeError}
          </p>
        )}

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep(step - 1)}
            className="rounded-full border border-[var(--line)] bg-transparent px-6 py-3 text-sm font-semibold text-[var(--ink-soft)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={finalizing}
            onClick={handleContinue}
            className="rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {finalizing ? 'Guardando…' : step === totalModules ? 'Finalizar' : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  );
}
