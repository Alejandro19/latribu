import Anthropic from '@anthropic-ai/sdk';
import { ALL_MARKER_IDS, type MarkerId } from './insights/marker-ranges.js';

// Unidades estándar BIO360 por marcador — mismas 32 unidades que ya usaba el
// parser legado del frontend (apps/web/lib/parse-lab-ocr-text.ts,
// OCR_FIELD_MAP). Se le pide a la IA normalizar cualquier valor a estas
// unidades antes de devolverlo — nunca se guarda en la unidad de origen.
export const MARKER_UNITS: Record<MarkerId, string> = {
  glucosa: 'mg/dL', hba1c: '%', ldl: 'mg/dL', hdl: 'mg/dL', trigliceridos: 'mg/dL',
  insulina: 'uUI/mL', homa_ir: '',
  pcr: 'mg/L', homocisteina: 'umol/L', ferritina: 'ng/mL',
  cortisol: 'ug/dL', testosterona_total: 'ng/dL', testosterona_libre: 'pg/mL',
  estradiol: 'pg/mL', dhea: 'ug/dL', tsh: 'uUI/mL', t3: 'pg/mL', t4: 'ng/dL',
  vitamina_d: 'ng/mL', b12: 'pg/mL', magnesio: 'mg/dL', zinc: 'ug/dL',
  creatinina: 'mg/dL', bun: 'mg/dL', tgo: 'U/L', tgp: 'U/L', ggt: 'U/L', colesterol_total: 'mg/dL',
  hemoglobina: 'g/dL', hematocrito: '%', leucocitos: 'x10³/uL', potasio: 'mEq/L',
  // Exclusivos de Edad Biológica (PhenoAge) — ver marker-ranges.ts.
  albumina: 'g/L', linfocitos_pct: '%', vcm: 'fL', rdw: '%', fosfatasa_alcalina: 'U/L',
};

export type ExtractedMarker = {
  marker_id: MarkerId;
  unit: string | null;
  value: number | null;
  detected: boolean;
};

export class AiNotConfiguredError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY no está configurada en el servidor.');
    this.name = 'AiNotConfiguredError';
  }
}
export class AiExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiExtractionError';
  }
}

const MODEL = 'claude-sonnet-5';

export type AiCaller = (prompt: string) => Promise<Array<{ marker_id: string; value: number | null; detected: boolean }>>;
let aiCallerOverride: AiCaller | null = null;

// Permite a los tests sustituir la llamada real a Claude (que requiere red y
// una API key real) por un doble de prueba determinista — mismo patrón que
// ocr.service.ts::setVisionCallerForTests.
export function setAiExtractorForTests(caller: AiCaller | null): void {
  aiCallerOverride = caller;
}

const EXTRACTION_TOOL = {
  name: 'reportar_marcadores',
  description: 'Reporta los valores de laboratorio detectados para cada marcador de la lista cerrada.',
  input_schema: {
    type: 'object' as const,
    properties: {
      markers: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            marker_id: { type: 'string', enum: ALL_MARKER_IDS },
            value: { type: ['number', 'null'], description: 'Valor ya normalizado a la unidad estándar indicada. null si no se detectó con confianza.' },
            detected: { type: 'boolean', description: 'true solo si el marcador se identificó con confianza en el texto.' },
          },
          required: ['marker_id', 'value', 'detected'],
        },
      },
    },
    required: ['markers'],
  },
};

function buildPrompt(ocrText: string): string {
  const markerList = ALL_MARKER_IDS.map((id) => `- ${id} (unidad estándar: ${MARKER_UNITS[id] || 'sin unidad'})`).join('\n');
  return `Eres un asistente que extrae valores de laboratorios clínicos a partir de texto plano obtenido por OCR de un PDF o imagen. El texto puede venir de laboratorios de cualquier país, con nombres de marcador distintos (español, inglés, abreviaturas) y unidades distintas.

Lista cerrada de marcadores a buscar (nunca reportes uno fuera de esta lista):
${markerList}

Reglas estrictas:
1. Para cada marcador de la lista, busca su valor en el texto, sin importar cómo esté nombrado (sinónimos, abreviaturas, en otro idioma).
2. Si encuentras el valor pero en una unidad distinta a la estándar indicada, conviértelo matemáticamente a la unidad estándar usando factores de conversión clínicos reales antes de reportarlo.
3. Si el documento está borroso, el formato no se reconoce, o no encuentras el campo con confianza razonable, reporta ese marcador con "detected": false y "value": null — NUNCA inventes ni aproximes un valor que no está claramente presente.
4. Reporta los ${ALL_MARKER_IDS.length} marcadores de la lista, uno por uno, incluso los no detectados.

Texto extraído por OCR:
---
${ocrText}
---`;
}

async function callRealAi(prompt: string): Promise<Array<{ marker_id: string; value: number | null; detected: boolean }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();

  const client = new Anthropic({ apiKey });
  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: EXTRACTION_TOOL.name },
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (e) {
    throw new AiExtractionError(e instanceof Error ? e.message : 'Error al contactar el servicio de IA.');
  }

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new AiExtractionError('La IA no devolvió una extracción estructurada.');
  }
  const input = toolUse.input as { markers?: Array<{ marker_id: string; value: number | null; detected: boolean }> };
  return input.markers ?? [];
}

export async function extractMarkersWithAI(ocrText: string): Promise<ExtractedMarker[]> {
  const caller = aiCallerOverride ?? callRealAi;
  const rawMarkers = await caller(buildPrompt(ocrText));

  // Defensa adicional más allá del prompt: nunca confiar en un marker_id
  // fuera de la lista cerrada, ni en un `detected: true` sin valor numérico.
  const knownIds = new Set<string>(ALL_MARKER_IDS);
  const byId = new Map<string, ExtractedMarker>();
  for (const m of rawMarkers) {
    if (!knownIds.has(m.marker_id)) continue;
    const id = m.marker_id as MarkerId;
    const detected = m.detected === true && typeof m.value === 'number';
    byId.set(id, { marker_id: id, value: detected ? m.value : null, unit: detected ? MARKER_UNITS[id] : null, detected });
  }

  // Cualquier marcador de la lista que la IA no haya reportado en absoluto
  // se completa como no detectado, para que el grid siempre muestre los 32.
  return ALL_MARKER_IDS.map((id) => byId.get(id) ?? { marker_id: id, value: null, unit: null, detected: false });
}
