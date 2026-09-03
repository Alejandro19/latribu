// Categorías de segmentación para el benchmark comparativo anonimizado de
// Mentoría (ver mentoring-benchmark.service.ts en apps/api) — confirmadas
// explícitamente con Alejandro antes de implementar para no tener que migrar
// datos después. No agregar/quitar valores sin actualizar la tabla
// `mentoring_benchmark_snapshots` ya acumulada.

export const MENTORING_AGE_BANDS = ['30-39', '40-49', '50-59', '60+'] as const;
export type MentoringAgeBand = (typeof MENTORING_AGE_BANDS)[number];

export const MENTORING_CARGO_TYPES = ['Fundador/Dueño', 'C-level', 'VP/Dirección', 'Otro'] as const;
export type MentoringCargoType = (typeof MENTORING_CARGO_TYPES)[number];

export const MENTORING_SECTORS = [
  'Tecnología',
  'Servicios financieros',
  'Retail/Consumo',
  'Manufactura/Industria',
  'Salud',
  'Construcción/Inmobiliario',
  'Servicios profesionales',
  'Otro',
] as const;
export type MentoringSector = (typeof MENTORING_SECTORS)[number];
