// Puerto de parseTimeToSeconds (index.html:2520-2526) — acepta "mm:ss" o un
// número suelto; cualquier valor vacío/no parseable/≤0 cae silenciosamente a
// 30s, igual que el legacy (nunca se valida en el formulario admin).
export function parseTimeToSeconds(value: string | null): number {
  if (!value) return 30;
  const trimmed = value.trim();
  const mmss = trimmed.match(/^(\d+):(\d+)$/);
  let seconds: number;
  if (mmss) {
    seconds = Number(mmss[1]) * 60 + Number(mmss[2]);
  } else {
    seconds = Number(trimmed.replace(/[^0-9.-]/g, ''));
  }
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 30;
}

// Puerto de youtubeEmbedUrl (index.html:2515-2518) — extrae el video id de
// cualquiera de las formas de URL de YouTube que el admin pueda pegar
// (watch?v=, embed/, shorts/, youtu.be/) y produce una URL de embed válida
// para <iframe>. Las URLs "watch" crudas son bloqueadas por YouTube via
// X-Frame-Options si se usan directo en un iframe.
export function youtubeEmbedUrl(url: string | null): string | null {
  if (!url) return null;
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}
