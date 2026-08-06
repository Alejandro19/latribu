import { getWeekStart } from './training-home-logic';
import type { CortisolCompletion } from './cortisol-client';

export const CORTISOL_EMOTIONS = [
  { key: 'ansioso', emoji: '😰', label: 'Ansioso/a' },
  { key: 'irritable', emoji: '😤', label: 'Irritable' },
  { key: 'cansado', emoji: '😴', label: 'Cansado/a' },
  { key: 'abrumado', emoji: '😵‍💫', label: 'Abrumado/a' },
  { key: 'tranquilo', emoji: '😌', label: 'Tranquilo/a' },
  { key: 'energia', emoji: '😄', label: 'Con energía' },
] as const;

export const CORTISOL_RECOMMENDATIONS: Record<string, { title: string; desc: string }> = {
  ansioso: { title: 'Respiración 4-7-8', desc: 'Calma la respuesta de alerta rápida del cuerpo.' },
  irritable: { title: 'Relajación muscular progresiva', desc: 'Libera la tensión física acumulada.' },
  cansado: { title: 'Meditación guiada breve', desc: 'Un descanso mental breve para recargar energía.' },
  abrumado: { title: 'Respiración de caja (4-4-4-4)', desc: 'Ordena tus pensamientos con un ritmo simple.' },
  tranquilo: { title: 'Sonidos para enfocar', desc: 'Mantén este estado mientras sigues con tu día.' },
  energia: { title: 'Meditación guiada breve', desc: 'Ancla esta energía antes de que el día la desgaste.' },
};

export function calculateCortisolWeeklyStats(completions: CortisolCompletion[]): { count: number; pct: number } {
  const weekStart = getWeekStart();
  const count = new Set(completions.filter((c) => c.completedDate >= weekStart).map((c) => c.completedDate)).size;
  const pct = Math.round((count / 7) * 100);
  return { count, pct };
}

export function formatDurationLabel(minutes: string | number | null, seconds: string | number | null): string {
  const m = Number(minutes) || 0;
  const s = Number(seconds) || 0;
  if (!m && !s) return '';
  return `${m}:${String(s).padStart(2, '0')} min`;
}
