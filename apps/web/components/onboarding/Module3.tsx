'use client';

import { useState } from 'react';
import { callOcr, uploadInbodyFile, updateClientObjetivos } from '../../lib/onboarding-client';
import { parseOcrText } from '../../lib/parse-ocr-text';
import SelectField from '../ui/SelectField';
import FloatingField from '../ui/FloatingField';
import FileField from '../ui/FileField';

// Secciones siempre visibles (no acordeón real: Module3 necesita que varios
// grupos de campos estén montados a la vez — el propio wizard ya organiza el
// avance módulo a módulo).
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] p-5">
      <h3 className="m-0 mb-4 text-[15px] font-bold text-[var(--ink)]">{title}</h3>
      {children}
    </div>
  );
}

export type Module3Draft = {
  weight: string;
  height: string;
  bodyFat: string;
  objetivos: { peso: string; grasa_corporal: string; masa_muscular: string };
  antropometria: { cintura: string; brazos: string; hombros: string; piernas: string; gluteo: string };
  inbody: {
    pesoTotal: string;
    smm: string;
    grasaPct: string;
    pesoObjetivo: string;
    grasaVisceral: string;
    bmr: string;
    anguloFase: string;
    ecwTbw: string;
    masaOsea: string;
    altura: string;
    imc: string;
    version: string | null;
    fileUrl: string | null;
    fileName: string | null;
    ocrDone: boolean;
  };
  photos: Partial<Record<'frente' | 'lado_derecho' | 'lado_izquierdo' | 'espalda', File>>;
};

export const EMPTY_MODULE3_DRAFT: Module3Draft = {
  weight: '', height: '', bodyFat: '',
  objetivos: { peso: '', grasa_corporal: '', masa_muscular: '' },
  antropometria: { cintura: '', brazos: '', hombros: '', piernas: '', gluteo: '' },
  inbody: {
    pesoTotal: '', smm: '', grasaPct: '', pesoObjetivo: '', grasaVisceral: '', bmr: '', anguloFase: '',
    ecwTbw: '', masaOsea: '', altura: '', imc: '', version: null, fileUrl: null, fileName: null, ocrDone: false,
  },
  photos: {},
};

// Ángulo de fase y toda la sección de medidas antropométricas quedan
// opcionales a propósito, igual que MODULE3_REQUIRED_FIELDS en el legacy.
const INBODY_REQUIRED_KEYS = ['pesoTotal', 'smm', 'grasaPct', 'pesoObjetivo', 'grasaVisceral', 'bmr', 'ecwTbw', 'masaOsea', 'altura'] as const;

export function validateModule3(draft: Module3Draft): string[] {
  const invalid: string[] = [];
  if (!draft.weight.trim()) invalid.push('weight');
  if (!draft.height.trim()) invalid.push('height');
  if (!draft.bodyFat.trim()) invalid.push('bodyFat');
  if (!draft.objetivos.peso) invalid.push('objetivo_peso');
  if (!draft.objetivos.grasa_corporal) invalid.push('objetivo_grasa_corporal');
  if (!draft.objetivos.masa_muscular) invalid.push('objetivo_masa_muscular');
  for (const key of INBODY_REQUIRED_KEYS) {
    if (!draft.inbody[key]) invalid.push(`inbody_${key}`);
  }
  return invalid;
}

export function computeImc(pesoTotal: string, altura: string): string {
  const w = parseFloat(pesoTotal) || 0;
  const h = parseFloat(altura) || 0;
  return w > 0 && h > 0 ? (w / Math.pow(h / 100, 2)).toFixed(1) : '';
}

const PHOTO_ANGLES = [
  { key: 'frente', label: 'Frente' },
  { key: 'lado_derecho', label: 'Lado derecho' },
  { key: 'lado_izquierdo', label: 'Lado izquierdo' },
  { key: 'espalda', label: 'Espalda' },
] as const;

const INBODY_NUMBER_FIELDS = [
  ['pesoTotal', 'Peso total (InBody)'],
  ['smm', 'Masa muscular esquelética'],
  ['grasaPct', '% Grasa corporal'],
  ['pesoObjetivo', 'Peso objetivo'],
  ['grasaVisceral', 'Grasa visceral'],
  ['bmr', 'Metabolismo basal (BMR)'],
  ['anguloFase', 'Ángulo de fase'],
  ['ecwTbw', 'Agua corporal total (L)'],
  ['masaOsea', 'Masa ósea'],
  ['altura', 'Estatura (InBody)'],
] as const;

const ANTROPOMETRIA_FIELDS = [
  ['cintura', 'Cintura (cm)'],
  ['brazos', 'Brazos (cm)'],
  ['hombros', 'Hombros (cm)'],
  ['piernas', 'Piernas (cm)'],
  ['gluteo', 'Glúteo (cm)'],
] as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export type Module3Props = {
  clientId: string;
  draft: Module3Draft;
  onChange: (draft: Module3Draft) => void;
  invalidFields: Set<string>;
};

export function Module3({ clientId, draft, onChange, invalidFields }: Module3Props) {
  const [ocrStatus, setOcrStatus] = useState<{ message: string; isError: boolean } | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);

  function setObjetivo(metrica: keyof Module3Draft['objetivos'], valor: string) {
    const objetivos = { ...draft.objetivos, [metrica]: valor };
    onChange({ ...draft, objetivos });
    // No fatal — igual que setObjetivo() en el legacy, el borrador local
    // avanza aunque esta escritura en segundo plano falle.
    updateClientObjetivos(clientId, objetivos).catch((e: Error) => {
      console.error('No se pudo guardar el objetivo:', e.message);
    });
  }

  async function handleInbodyFile(file: File) {
    if (file.size > 25 * 1024 * 1024) {
      setOcrStatus({ message: 'El archivo excede 25 MB.', isError: true });
      return;
    }
    setOcrBusy(true);
    setOcrStatus({ message: 'Procesando archivo…', isError: false });
    try {
      const base64 = await fileToBase64(file);
      const { text } = await callOcr(clientId, base64);
      if (!text.trim()) throw new Error('No se pudo extraer texto. Exporta el reporte como JPG/PNG e intenta de nuevo.');
      const parsed = parseOcrText(text);
      const parsedCount = Object.entries(parsed).filter(([k, v]) => k !== '_version' && v != null).length;
      if (parsedCount === 0) throw new Error('No se detectaron campos. Intenta con una captura JPG/PNG del reporte InBody.');

      const nextInbody = {
        ...draft.inbody,
        pesoTotal: parsed.peso_total != null ? String(parsed.peso_total) : '',
        smm: parsed.smm != null ? String(parsed.smm) : '',
        grasaPct: parsed.grasa_pct != null ? String(parsed.grasa_pct) : '',
        pesoObjetivo: parsed.peso_objetivo != null ? String(parsed.peso_objetivo) : '',
        grasaVisceral: parsed.grasa_visceral != null ? String(parsed.grasa_visceral) : '',
        bmr: parsed.bmr != null ? String(parsed.bmr) : '',
        anguloFase: parsed.angulo_fase != null ? String(parsed.angulo_fase) : '',
        ecwTbw: parsed.ecw_tbw != null ? String(parsed.ecw_tbw) : '',
        masaOsea: parsed.masa_osea != null ? String(parsed.masa_osea) : '',
        altura: parsed.height != null ? String(parsed.height) : '',
        version: parsed._version ?? null,
        ocrDone: true,
      };
      nextInbody.imc = computeImc(nextInbody.pesoTotal, nextInbody.altura);

      let fileAttached = false;
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      try {
        const uploaded = await uploadInbodyFile(clientId, file);
        fileUrl = uploaded.file_url;
        fileName = uploaded.file_name;
        fileAttached = true;
      } catch (e) {
        console.error('inbody-upload falló:', e);
      }

      onChange({ ...draft, inbody: { ...nextInbody, fileUrl, fileName } });
      setOcrStatus({
        message: fileAttached
          ? `${parsedCount} campos detectados y rellenados. Archivo adjuntado.`
          : `${parsedCount} campos detectados y rellenados, pero el archivo original NO se pudo adjuntar — inténtalo de nuevo antes de continuar.`,
        isError: !fileAttached,
      });
    } catch (e) {
      setOcrStatus({ message: e instanceof Error ? e.message : 'Error al procesar el archivo.', isError: true });
    } finally {
      setOcrBusy(false);
    }
  }

  const objetivoOptions = [
    { value: 'bajar', label: 'Bajar' },
    { value: 'mantener', label: 'Mantener' },
    { value: 'subir', label: 'Subir' },
  ];

  return (
    <div className="space-y-5">
      <Section title="Composición corporal">
        <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FloatingField
                  id="field-weight" label="Peso (kg)" type="number"
                  value={draft.weight} onChange={(v) => onChange({ ...draft, weight: v })}
                  invalid={invalidFields.has('weight')}
                />
                <FloatingField
                  id="field-height" label="Estatura (cm)" type="number"
                  value={draft.height} onChange={(v) => onChange({ ...draft, height: v })}
                  invalid={invalidFields.has('height')}
                />
                <FloatingField
                  id="field-body-fat" label="% Grasa corporal (si lo conoces)" type="number"
                  value={draft.bodyFat} onChange={(v) => onChange({ ...draft, bodyFat: v })}
                  invalid={invalidFields.has('bodyFat')}
                />
              </div>

              <p className="m-0 font-serif text-[14.5px] font-semibold text-[var(--ink)]">
                Tus objetivos de composición corporal
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(['peso', 'grasa_corporal', 'masa_muscular'] as const).map((metrica) => (
                  <div key={metrica}>
                    <SelectField
                      id={`objetivo-${metrica}`}
                      label={`¿Cuál es tu objetivo de ${metrica.replace('_', ' ')}?`}
                      placeholder="Selecciona…"
                      value={draft.objetivos[metrica]}
                      onChange={(v) => setObjetivo(metrica, v)}
                      options={objetivoOptions}
                    />
                    {invalidFields.has(`objetivo_${metrica}`) && (
                      <p role="alert" className="mt-1.5 text-xs text-[var(--danger)]">Este campo es obligatorio.</p>
                    )}
                  </div>
                ))}
              </div>
        </div>
      </Section>

      <Section title="Cargar análisis InBody">
        <div className="space-y-5">
              <FileField
                id="field-inbody-file"
                label="Sube el PDF o una foto de tu reporte InBody"
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={ocrBusy}
                fileName={draft.inbody.fileName}
                helper="Detectamos los campos automáticamente al subir el archivo."
                onFileChange={(file) => { if (file) void handleInbodyFile(file); }}
              />
              {ocrStatus && (
                <p role={ocrStatus.isError ? 'alert' : 'status'} className={`text-sm ${ocrStatus.isError ? 'text-[var(--danger)]' : 'text-[var(--ink-soft)]'}`}>
                  {ocrStatus.message}
                </p>
              )}
              {draft.inbody.version && (
                <p className="text-xs text-[var(--ink-soft)]">Versión detectada: {draft.inbody.version}</p>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {INBODY_NUMBER_FIELDS.map(([key, label]) => (
                  <FloatingField
                    key={key}
                    id={`inbody-${key}`} label={label} type="number"
                    value={draft.inbody[key]}
                    onChange={(v) => {
                      const nextInbody = { ...draft.inbody, [key]: v };
                      if (key === 'pesoTotal' || key === 'altura') nextInbody.imc = computeImc(nextInbody.pesoTotal, nextInbody.altura);
                      onChange({ ...draft, inbody: nextInbody });
                    }}
                    invalid={invalidFields.has(`inbody_${key}`)}
                  />
                ))}
                <FloatingField id="inbody-imc" label="IMC calculado" value={draft.inbody.imc} onChange={() => {}} disabled />
              </div>
        </div>
      </Section>

      <Section title="Medidas antropométricas (opcional)">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {ANTROPOMETRIA_FIELDS.map(([key, label]) => (
                <FloatingField
                  key={key}
                  id={`antropometria-${key}`} label={label} type="number"
                  value={draft.antropometria[key]}
                  onChange={(v) => onChange({ ...draft, antropometria: { ...draft.antropometria, [key]: v } })}
                />
              ))}
            </div>
      </Section>

      <Section title="Fotos de progreso (opcional)">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {PHOTO_ANGLES.map((angle) => (
                <FileField
                  key={angle.key}
                  id={`photo-${angle.key}`}
                  label={angle.label}
                  accept="image/*"
                  fileName={draft.photos[angle.key]?.name ?? null}
                  onFileChange={(file) => onChange({ ...draft, photos: { ...draft.photos, [angle.key]: file ?? undefined } })}
                />
              ))}
            </div>
      </Section>
    </div>
  );
}
