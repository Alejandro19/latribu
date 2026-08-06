import type { TrainingCompletion } from './training-client';

function isoLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Semana calendario lunes→domingo — mismo criterio que el legacy (index.html
// getWeekStart) y que apps/api's weekStartInTz, pero calculado en el reloj
// local del navegador (esta función corre en el cliente).
export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day));
  d.setHours(0, 0, 0, 0);
  return isoLocalDate(d);
}

export function isDayCompletedThisWeek(dayNumber: number, completions: TrainingCompletion[]): boolean {
  const weekStart = getWeekStart();
  return completions.some((c) => c.dayNumber === dayNumber && c.completedDate >= weekStart);
}

export function isDayUnlocked(dayNumber: number, completions: TrainingCompletion[]): boolean {
  return dayNumber === 1 || isDayCompletedThisWeek(dayNumber - 1, completions);
}

export function calculateDisciplineStats(
  completions: TrainingCompletion[],
  trainingDays: number
): { doneDays: number; expected: number; pct: number } {
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;
  const doneDays = new Set(completions.filter((c) => c.completedDate.startsWith(monthPrefix)).map((c) => c.completedDate)).size;
  const expected = (trainingDays || 0) * 4;
  const pct = expected > 0 ? Math.round((doneDays / expected) * 100) : 0;
  return { doneDays, expected, pct };
}
