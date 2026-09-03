// "21 jul, 10:21am" — nunca el timestamp crudo. Igual que index.html:4943.
export function formatEventDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '-';
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  let h = d.getHours();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${h}:${min}${ampm}`;
}

// Categoría heurística por título — el esquema no tiene un campo de
// categoría dedicado, igual que en el legacy (index.html:4954-4972). Se
// devuelve una clave (no un emoji) que CommunityVisuals.tsx resuelve a un
// ícono de línea.
export type EventCategoryKey = 'ice' | 'mindful' | 'activity' | 'heat' | 'social' | 'default';
export type TherapyCategoryKey = 'massage' | 'physio' | 'nutrition' | 'mental' | 'default';

export function eventCategoryIcon(title: string | null): EventCategoryKey {
  const t = (title || '').toLowerCase();
  if (/hielo|ice\b|frío|frio/.test(t)) return 'ice';
  if (/medita|mindful|respira|yoga/.test(t)) return 'mindful';
  if (/circuito|entrena|fuerza|cardio|running|correr|hiit/.test(t)) return 'activity';
  if (/sauna|calor/.test(t)) return 'heat';
  if (/comunidad|social|cena|desayuno|brunch/.test(t)) return 'social';
  return 'default';
}

export function therapyCategoryIcon(title: string | null): TherapyCategoryKey {
  const t = (title || '').toLowerCase();
  if (/masaje|spa/.test(t)) return 'massage';
  if (/fisio/.test(t)) return 'physio';
  if (/nutri/.test(t)) return 'nutrition';
  if (/biodescod|psicolog|terapia|coach|mental/.test(t)) return 'mental';
  return 'default';
}
