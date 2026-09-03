// Puerto fiel de OCR_FIELD_MAP + parseOcrText + _extractFirstValue
// (BIO360Index.html:13672-13899) — parser de biomarcadores de laboratorio
// a partir del texto plano que devuelve /clients/:id/ocr-vision (Google
// Cloud Vision). No simplificar los rangos/regex sin volver a validar
// contra reportes de laboratorio reales.

export type LabFieldMeta = {
  field: string;
  lbl: string;
  unit: string;
  opt: [number, number];
  lowerBetter: boolean;
  kw: string[];
  re: RegExp[];
};

export const OCR_FIELD_MAP: LabFieldMeta[] = [
  // PERFIL METABÓLICO
  { field: 'glucosa', lbl: 'Glucosa', unit: 'mg/dL', opt: [70, 100], lowerBetter: true,
    kw: ['glucosa', 'glicemia', 'glucose', 'glycemia', 'glicemia en sangre', 'glucosa en ayunas'],
    re: [/glic[eo]mia[^\n]{0,60}?(\d+[.,]?\d*)/i, /glucosa[^\n]{0,60}?(\d+[.,]?\d*)/i, /glucose[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  { field: 'hba1c', lbl: 'HbA1c', unit: '%', opt: [4.0, 5.7], lowerBetter: true,
    kw: ['hba1c', 'hemoglobina glicosilada', 'hemoglobina glicada', 'a1c'],
    re: [/hba[\s_]?1c[^\n]{0,60}?(\d+[.,]\d+)/i, /hemoglobina\s+glic[oa]s[^\n]{0,60}?(\d+[.,]\d+)/i, /a1c[^\n]{0,40}?(\d+[.,]\d+)/i] },
  { field: 'ldl', lbl: 'LDL', unit: 'mg/dL', opt: [0, 100], lowerBetter: true,
    kw: ['colesterol baja densidad', 'ldl calculado', 'ldl directo', 'ldl colesterol'],
    re: [/colesterol\s+(?:baja|low)[^\n]{0,60}?(\d+[.,]?\d*)/i, /\bldl\b[^\n]{0,20}?(\d+[.,]?\d*)(?=[a-zA-Z])/i] },
  { field: 'hdl', lbl: 'HDL', unit: 'mg/dL', opt: [60, 999], lowerBetter: false,
    kw: ['colesterol alta densidad', 'colesterol hd', 'hdl colesterol'],
    re: [/colesterol\s+(?:alta|high)[^\n]{0,60}?(\d+[.,]?\d*)/i, /\bhdl\b[^\n]{0,20}?(\d+[.,]?\d*)(?=[a-zA-Z])/i] },
  { field: 'trigliceridos', lbl: 'Triglicéridos', unit: 'mg/dL', opt: [0, 150], lowerBetter: true,
    kw: ['trigliceridos', 'triglicéridos', 'triglycerides', 'triglicerido'],
    re: [/triglic[eé]rid[oa]s?[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  { field: 'insulina', lbl: 'Insulina', unit: 'uUI/mL', opt: [0, 10], lowerBetter: true,
    kw: ['insulina', 'insulin'],
    re: [/insulina[^\n]{0,60}?(\d+[.,]?\d*)/i, /insulin[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  { field: 'homa_ir', lbl: 'HOMA-IR', unit: '', opt: [0, 2.5], lowerBetter: true,
    kw: ['homa-ir', 'homa ir', 'homa'],
    re: [/homa[-_\s]?ir[^\n]{0,40}?(\d+[.,]\d+)/i] },
  // INFLAMACIÓN
  { field: 'pcr', lbl: 'PCR', unit: 'mg/L', opt: [0, 1.0], lowerBetter: true,
    kw: ['proteina c reactiva', 'proteína c reactiva', 'pcr', 'c reactive', 'crp'],
    re: [/prote[ií]na\s*c\s*reactiva[^\n]{0,60}?(\d+[.,]\d+)/i, /\bpcr\b[^\n]{0,60}?(\d+[.,]\d+)/i, /\bcrp\b[^\n]{0,60}?(\d+[.,]\d+)/i] },
  { field: 'homocisteina', lbl: 'Homocisteína', unit: 'umol/L', opt: [0, 10], lowerBetter: true,
    kw: ['homocisteina', 'homocistéina', 'homocysteine'],
    re: [/homociste[ií]na[^\n]{0,60}?(\d+[.,]\d+)/i] },
  { field: 'ferritina', lbl: 'Ferritina', unit: 'ng/mL', opt: [70, 150], lowerBetter: false,
    kw: ['ferritina', 'ferritin'],
    re: [/ferritina[^\n]{0,60}?(\d+[.,]?\d*)/i, /ferritin[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  // HORMONAS
  { field: 'cortisol', lbl: 'Cortisol', unit: 'ug/dL', opt: [6, 18], lowerBetter: false,
    kw: ['cortisol'],
    re: [/cortisol[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  { field: 'testosterona_total', lbl: 'Testosterona Total', unit: 'ng/dL', opt: [400, 800], lowerBetter: false,
    kw: ['testosterona total', 'testosterone total', 'testosterona t'],
    re: [/testosterona\s+total[^\n]{0,60}?(\d+[.,]?\d*)/i, /testosterone\s+total[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  { field: 'testosterona_libre', lbl: 'Testosterona Libre', unit: 'pg/mL', opt: [9, 30], lowerBetter: false,
    kw: ['testosterona libre', 'testosterone libre', 'testosterona l'],
    re: [/testosterona\s+libre[^\n]{0,60}?(\d+[.,]?\d*)/i, /testosterone\s+libre[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  { field: 'estradiol', lbl: 'Estradiol', unit: 'pg/mL', opt: [10, 40], lowerBetter: false,
    kw: ['estradiol', 'estrogen', 'estrógeno'],
    re: [/estradiol[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  { field: 'dhea', lbl: 'DHEA-S', unit: 'ug/dL', opt: [100, 500], lowerBetter: false,
    kw: ['dhea-s', 'dhea s', 'dheas', 'dehidroepiandrosterona'],
    re: [/dhea[-_\s]?s[^\n]{0,60}?(\d+[.,]?\d*)/i, /dehidroepiandrosterona[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  { field: 'tsh', lbl: 'TSH', unit: 'uUI/mL', opt: [0.5, 2.5], lowerBetter: false,
    kw: ['tsh ultrasensible', 'tsh reflex', 'tsh 3ra', 'tsh', 'tirotropina'],
    re: [/tsh[^\n]{0,60}?(\d+[.,]\d+)/i, /tirotropina[^\n]{0,60}?(\d+[.,]\d+)/i] },
  { field: 't3', lbl: 'T3 Libre', unit: 'pg/mL', opt: [2.3, 4.2], lowerBetter: false,
    kw: ['t3 libre', 'triyodotironina libre', 'ft3'],
    re: [/t3\s+libre[^\n]{0,60}?(\d+[.,]\d+)/i, /\bft3\b[^\n]{0,60}?(\d+[.,]\d+)/i, /triyodotironina\s+libre[^\n]{0,60}?(\d+[.,]\d+)/i] },
  { field: 't4', lbl: 'T4 Libre', unit: 'ng/dL', opt: [0.8, 1.8], lowerBetter: false,
    kw: ['t4 libre', 'tiroxina libre', 'ft4'],
    re: [/t4\s+libre[^\n]{0,60}?(\d+[.,]\d+)/i, /\bft4\b[^\n]{0,60}?(\d+[.,]\d+)/i, /tiroxina\s+libre[^\n]{0,60}?(\d+[.,]\d+)/i] },
  // VITAMINAS Y MINERALES
  { field: 'vitamina_d', lbl: 'Vitamina D', unit: 'ng/mL', opt: [50, 80], lowerBetter: false,
    kw: ['vitamina d.25', 'vitamina d 25', '25-hidroxi', '25 hidroxi', 'vitamina d'],
    re: [/vitamina\s+d[^\n]{0,60}?(\d+[.,]?\d*)(?=[a-zA-Z])/i, /25[-\s]?oh[-\s]?d[^\n]{0,60}?(\d+[.,]?\d*)(?=[a-zA-Z])/i] },
  { field: 'b12', lbl: 'Vitamina B12', unit: 'pg/mL', opt: [400, 900], lowerBetter: false,
    kw: ['vitamina b12', 'vitamina b 12', 'cobalamina', 'b12', 'b-12'],
    re: [/vitamina\s*b[-\s]?12[^\n]{0,60}?(\d+[.,]?\d*)/i, /\bb[-\s]?12\b[^\n]{0,60}?(\d+[.,]?\d*)/i, /cobalamina[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  { field: 'magnesio', lbl: 'Magnesio', unit: 'mg/dL', opt: [1.7, 2.2], lowerBetter: false,
    kw: ['magnesio', 'magnesium'],
    re: [/magnesio[^\n]{0,60}?(\d+[.,]\d+)/i, /magnesium[^\n]{0,60}?(\d+[.,]\d+)/i] },
  { field: 'zinc', lbl: 'Zinc', unit: 'ug/dL', opt: [70, 120], lowerBetter: false,
    kw: ['zinc'],
    re: [/\bzinc\b[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  // FUNCIÓN RENAL Y HEPÁTICA
  { field: 'creatinina', lbl: 'Creatinina', unit: 'mg/dL', opt: [0.6, 1.1], lowerBetter: true,
    kw: ['creatinina', 'creatinine'],
    re: [/creatinina[^\n]{0,60}?(\d+[.,]\d+)/i, /creatinine[^\n]{0,60}?(\d+[.,]\d+)/i] },
  { field: 'bun', lbl: 'BUN / Urea', unit: 'mg/dL', opt: [7, 25], lowerBetter: true,
    kw: ['bun', 'urea nitrogenada', 'nitrogeno ureico', 'blood urea'],
    re: [/\bbun\b[^\n]{0,60}?(\d+[.,]?\d*)/i, /urea\s+nitrog[^\n]{0,60}?(\d+[.,]?\d*)/i, /nitr[oó]geno\s+ure[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  { field: 'tgo', lbl: 'TGO / AST', unit: 'U/L', opt: [0, 40], lowerBetter: true,
    kw: ['tgo', 'ast', 'aspartato aminotransferasa', 'aspartate'],
    re: [/\btgo\b[^\n]{0,60}?(\d+[.,]?\d*)/i, /\bast\b[^\n]{0,60}?(\d+[.,]?\d*)/i, /aspartato[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  { field: 'tgp', lbl: 'TGP / ALT', unit: 'U/L', opt: [0, 56], lowerBetter: true,
    kw: ['tgp', 'alt', 'alanina aminotransferasa', 'alanine'],
    re: [/\btgp\b[^\n]{0,60}?(\d+[.,]?\d*)/i, /\balt\b[^\n]{0,60}?(\d+[.,]?\d*)/i, /alanina[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  { field: 'ggt', lbl: 'GGT', unit: 'U/L', opt: [0, 48], lowerBetter: true,
    kw: ['ggt', 'gamma gt', 'gamma-gt', 'gammaglutamil'],
    re: [/\bggt\b[^\n]{0,60}?(\d+[.,]?\d*)/i, /gamma[-\s]?gt[^\n]{0,60}?(\d+[.,]?\d*)/i, /gammaglutamil[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  { field: 'colesterol_total', lbl: 'Colesterol Total', unit: 'mg/dL', opt: [0, 200], lowerBetter: true,
    kw: ['colesterol total', 'cholesterol total', 'colesterol'],
    re: [/colesterol\s+total[^\n]{0,60}?(\d+[.,]?\d*)/i, /cholesterol\s+total[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  // HEMATOLOGÍA
  { field: 'hemoglobina', lbl: 'Hemoglobina', unit: 'g/dL', opt: [12, 17.5], lowerBetter: false,
    kw: ['hemoglobina', 'haemoglobin', 'hgb'],
    re: [/hemoglobina[^\n]{0,60}?(\d+[.,]\d+)/i, /\bhgb\b[^\n]{0,60}?(\d+[.,]\d+)/i] },
  { field: 'hematocrito', lbl: 'Hematocrito', unit: '%', opt: [36, 52], lowerBetter: false,
    kw: ['hematocrito', 'hematocrit', 'hct'],
    re: [/hematocrito[^\n]{0,60}?(\d+[.,]\d+)/i, /\bhct\b[^\n]{0,60}?(\d+[.,]\d+)/i] },
  { field: 'leucocitos', lbl: 'Leucocitos', unit: 'x10³/uL', opt: [4.5, 11.0], lowerBetter: false,
    kw: ['leucocitos', 'globulos blancos', 'glóbulos blancos', 'wbc', 'leucocytes'],
    re: [/leucocitos[^\n]{0,60}?(\d+[.,]?\d*)/i, /gl[oó]bulos\s+blancos[^\n]{0,60}?(\d+[.,]?\d*)/i, /\bwbc\b[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  { field: 'potasio', lbl: 'Potasio', unit: 'mEq/L', opt: [3.5, 5.0], lowerBetter: false,
    kw: ['potasio', 'potassium'],
    re: [/potasio[^\n]{0,60}?(\d+[.,]\d+)/i, /potassium[^\n]{0,60}?(\d+[.,]\d+)/i] },
  // EXCLUSIVOS DE EDAD BIOLÓGICA (PhenoAge) — sin rango óptimo propio en
  // Matriz_Reglas_Mentoria.xlsx (no forman parte del panel original de 32);
  // rangos de referencia clínica estándar solo para mostrar en el grid, ver
  // marker-ranges.ts para el detalle de por qué no están en FIXED_MARKER_RANGES.
  { field: 'albumina', lbl: 'Albúmina', unit: 'g/L', opt: [35, 50], lowerBetter: false,
    kw: ['albumina', 'albúmina', 'albumin'],
    re: [/alb[uú]mina[^\n]{0,60}?(\d+[.,]?\d*)/i, /albumin[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  { field: 'linfocitos_pct', lbl: '% Linfocitos', unit: '%', opt: [20, 40], lowerBetter: false,
    kw: ['% linfocitos', 'linfocitos %', 'linfocitos', 'lymphocytes'],
    re: [/linfocitos[^\n]{0,60}?(\d+[.,]?\d*)\s*%/i, /%\s*linfocitos[^\n]{0,60}?(\d+[.,]?\d*)/i, /lymphocytes[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  { field: 'vcm', lbl: 'VCM', unit: 'fL', opt: [80, 100], lowerBetter: false,
    kw: ['vcm', 'mcv', 'volumen corpuscular medio', 'mean corpuscular volume'],
    re: [/\bvcm\b[^\n]{0,60}?(\d+[.,]?\d*)/i, /\bmcv\b[^\n]{0,60}?(\d+[.,]?\d*)/i, /volumen\s+corpuscular\s+medio[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  { field: 'rdw', lbl: 'RDW', unit: '%', opt: [11.5, 14.5], lowerBetter: true,
    kw: ['rdw', 'amplitud de distribución eritrocitaria', 'red cell distribution width'],
    re: [/\brdw\b[^\n]{0,60}?(\d+[.,]?\d*)/i, /amplitud\s+de\s+distribuci[oó]n\s+eritrocitaria[^\n]{0,60}?(\d+[.,]?\d*)/i] },
  { field: 'fosfatasa_alcalina', lbl: 'Fosfatasa Alcalina', unit: 'U/L', opt: [40, 129], lowerBetter: true,
    kw: ['fosfatasa alcalina', 'alkaline phosphatase', 'fal', 'alp'],
    re: [/fosfatasa\s+alcalina[^\n]{0,60}?(\d+[.,]?\d*)/i, /alkaline\s+phosphatase[^\n]{0,60}?(\d+[.,]?\d*)/i, /\bfal\b[^\n]{0,60}?(\d+[.,]?\d*)/i] },
];

// Extrae el valor de una línea "valor+unidad+referencia" concatenada.
// Ej: "*3.9710^3/ul410" → 3.97,  "89.31mg/dl74106" → 89.31
function extractFirstValue(line: string): number | null {
  const clean = line.trim().replace(/^\*\s*/, '');
  const m = clean.match(/^(\d+[.,]?\d*)(?=[a-zA-Z%]|10[\^])/);
  if (m) {
    const v = parseFloat(m[1].replace(',', '.'));
    if (!isNaN(v) && v > 0) return v;
  }
  const m2 = clean.match(/(\d+[.,]\d+)/);
  if (m2) {
    const v2 = parseFloat(m2[1].replace(',', '.'));
    if (!isNaN(v2) && v2 > 0) return v2;
  }
  return null;
}

export function parseLabOcrText(text: string): Record<string, number> {
  const result: Record<string, number> = {};
  const norm = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[ \t]{2,}/g, ' ');
  const lines = norm.split('\n').map((l) => l.trim());

  for (const m of OCR_FIELD_MAP) {
    // Pass 1: búsqueda por palabra clave — nombre en línea j, valor en la
    // siguiente línea numérica.
    if (m.kw.length > 0) {
      let found = false;
      for (let j = 0; j < lines.length && !found; j++) {
        const lineL = lines[j].toLowerCase();
        if (!m.kw.some((k) => lineL.indexOf(k) >= 0)) continue;
        for (let d = 1; d <= 8; d++) {
          const vline = lines[j + d];
          if (!vline) break;
          if (/^[*\s]*\d/.test(vline)) {
            const val = extractFirstValue(vline);
            if (val !== null && !(val >= 1900 && val <= 2100)) {
              result[m.field] = val;
              found = true;
            }
            break;
          }
          if (/^[A-Za-záéíóúñü]/.test(vline) && vline.length > 4) continue;
        }
      }
    }

    // Pass 2: regex sobre el texto completo (formatos en la misma línea).
    if (result[m.field] === undefined) {
      for (const re of m.re) {
        const match = norm.match(re);
        if (match) {
          const v = parseFloat(match[1].replace(',', '.'));
          if (!isNaN(v) && v > 0 && !(v >= 1900 && v <= 2100)) {
            result[m.field] = v;
            break;
          }
        }
      }
    }
  }

  // Normalizar nombre de campo para el formulario (b12 → vitamina_b12)
  if (result.b12 !== undefined) {
    result.vitamina_b12 = result.b12;
    delete result.b12;
  }

  return result;
}
