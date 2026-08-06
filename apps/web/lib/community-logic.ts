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

// Ícono heurístico por título — el esquema no tiene un campo de categoría
// dedicado, igual que en el legacy (index.html:4954-4972).
export function eventCategoryIcon(title: string | null): string {
  const t = (title || '').toLowerCase();
  if (/hielo|ice\b|frío|frio/.test(t)) return '🧊';
  if (/medita|mindful|respira|yoga/.test(t)) return '🧘';
  if (/circuito|entrena|fuerza|cardio|running|correr|hiit/.test(t)) return '🏃';
  if (/sauna|calor/.test(t)) return '🔥';
  if (/comunidad|social|cena|desayuno|brunch/.test(t)) return '🤝';
  return '📅';
}

export function therapyCategoryIcon(title: string | null): string {
  const t = (title || '').toLowerCase();
  if (/masaje|spa/.test(t)) return '💆';
  if (/fisio/.test(t)) return '🩺';
  if (/nutri/.test(t)) return '🥗';
  if (/biodescod|psicolog|terapia|coach|mental/.test(t)) return '🧠';
  return '📅';
}
