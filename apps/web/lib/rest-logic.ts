export function isMentoringClient(clientType: string | null | undefined): boolean {
  return clientType === 'mentoring';
}

export function formatMinutesDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// "11:48pm" — mismo formato que el legacy: hora local corta, am/pm pegado y en minúscula.
export function formatClockTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
    .replace(/\s?([ap])\.?\s?m\.?/i, '$1m')
    .toLowerCase();
}

// "hace 12 min" / "hace 3 h" / "hace 2 días" — frescura de la última sincronización.
export function formatRelativeSync(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} día${days === 1 ? '' : 's'}`;
}

export function sleepScoreLabel(score: number | null): string {
  if (score == null) return 'sin datos';
  if (score >= 80) return 'óptimo';
  if (score >= 60) return 'bueno';
  return 'bajo';
}

// Promedio de un campo numérico entre varias filas de métricas, ignorando nulos.
export function average(values: Array<number | string | null | undefined>): number | null {
  const nums = values.map((v) => (v == null ? null : Number(v))).filter((v): v is number => v != null && !Number.isNaN(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
