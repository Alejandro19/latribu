import pdfParse from 'pdf-parse';

export type VisionCaller = (base64: string, apiKey: string) => Promise<string>;

let visionCallerOverride: VisionCaller | null = null;

// Permite a los tests sustituir la llamada real a Google Vision (que
// requiere red y una API key real) por un doble de prueba determinista.
export function setVisionCallerForTests(caller: VisionCaller | null): void {
  visionCallerOverride = caller;
}

async function callVisionApi(base64: string, apiKey: string): Promise<string> {
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ image: { content: base64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }],
    }),
  });
  const parsed = await res.json();
  if (res.status === 401) throw new Error('AUTH_ERROR');
  if (res.status === 403) throw new Error('FORBIDDEN: Cloud Vision API no habilitada o sin permiso.');
  if (res.status !== 200) {
    const msg = parsed.error?.message || parsed.error?.status || `Vision API error ${res.status}`;
    if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('api key')) {
      throw new Error(`API_KEY_ERROR: ${msg}`);
    }
    throw new Error(msg);
  }
  return parsed.responses?.[0]?.fullTextAnnotation?.text || '';
}

async function pdfFallback(base64: string): Promise<string> {
  const buf = Buffer.from(base64, 'base64');
  // pdf-parse embebe versiones antiguas de pdf.js que corrompen el parseo si
  // se les pasa un Buffer de Node directamente (Buffer.prototype.slice no
  // copia, a diferencia de Uint8Array.prototype.slice, y ese código legado
  // asume semántica de copia). Se convierte a un Uint8Array real antes de
  // pasarlo, si no, PDFs válidos generados con herramientas modernas fallan
  // con "bad XRef entry" pese a estar bien formados.
  const bytes = new Uint8Array(buf.length);
  bytes.set(buf);
  // @types/pdf-parse declares the param as Buffer, but at runtime we must pass
  // a plain Uint8Array (see comment above) — the cast only affects the type,
  // not the value.
  const pdfParseInput = bytes as unknown as Buffer;
  const versions = ['v1.10.100', 'v1.9.426', 'default'] as const;
  let lastErr: unknown;
  for (const version of versions) {
    try {
      const data = await pdfParse(pdfParseInput, { version });
      if (data.text && data.text.trim()) return data.text;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('No se pudo extraer texto del PDF.');
}

export type OcrResult = { text: string; source: 'vision' | 'pdf-parse' };

export class FileTooLargeError extends Error {
  constructor() {
    super('La imagen excede 8 MB. Comprime la foto antes de subirla.');
    this.name = 'FileTooLargeError';
  }
}
export class ApiKeyError extends Error {
  constructor() {
    super('Google Vision API key vencida o inválida.');
    this.name = 'ApiKeyError';
  }
}
export class VisionApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VisionApiError';
  }
}
export class VisionNotConfiguredError extends Error {
  constructor() {
    super('GOOGLE_VISION_API_KEY no está configurada en el servidor.');
    this.name = 'VisionNotConfiguredError';
  }
}

export async function extractText(base64: string): Promise<OcrResult> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  const isPdf = base64.startsWith('JVBERi0');
  const sizeKB = Math.round((base64.length * 0.75) / 1024);
  if (sizeKB > 8000) throw new FileTooLargeError();

  if (isPdf) {
    try {
      const quickText = await pdfFallback(base64);
      if (quickText && quickText.trim()) return { text: quickText, source: 'pdf-parse' };
    } catch {
      // sigue a Vision API
    }
  }

  if (apiKey) {
    try {
      const caller = visionCallerOverride ?? callVisionApi;
      const text = await caller(base64, apiKey);
      if (text && text.trim()) return { text, source: 'vision' };
      if (!isPdf) return { text: '', source: 'vision' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.startsWith('API_KEY_ERROR')) throw new ApiKeyError();
      const fallbackable =
        isPdf && (msg === 'AUTH_ERROR' || msg === 'TIMEOUT' || msg.includes('BILLING') || msg.includes('QUOTA') || msg.includes('RESOURCE_EXHAUSTED'));
      if (!fallbackable) throw new VisionApiError(msg || 'Error al procesar el archivo.');
    }
  } else if (!isPdf) {
    throw new VisionNotConfiguredError();
  }

  const text = await pdfFallback(base64);
  return { text, source: 'pdf-parse' };
}
