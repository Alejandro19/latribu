// Puerto de MANTRA_BANK / pickMantra (index.html:960-998) — frases cortas,
// elegidas al azar en cada carga, sin relación con el sistema de "frases"
// administrables de Entrenamiento (quotes-client.ts). Puramente decorativo,
// una por módulo.
const MANTRA_BANK: Record<string, string[]> = {
  'personal-info': [
    'Cada dato que compartes ajusta el ritmo a tu medida.',
    'Conocerte es el primer paso para acompañarte bien.',
    'Aquí no hay respuestas perfectas, solo tu punto de partida.',
  ],
  nutrition: [
    'Nutrir el cuerpo es una forma de gratitud.',
    'Comer con conciencia también es descansar la mente.',
    'Cada comida es una oportunidad, no un examen.',
    'Tu plato refleja el cuidado que te estás dando hoy.',
  ],
  cortisol: [
    'Regular no es debilidad, es estrategia.',
    'Respirar despacio también es avanzar.',
    'La calma se entrena igual que el cuerpo.',
    'No tienes que apagar la tormenta, solo bajar el volumen.',
  ],
  rest: [
    'El descanso también es parte del entrenamiento.',
    'Dormir bien es un acto de disciplina, no de pereza.',
    'La recuperación es donde el esfuerzo se convierte en progreso.',
  ],
  community: [
    'Nadie mejora solo — la tribu sostiene el ritmo.',
    'Presencia, no competencia.',
    'Compartir el proceso lo hace más liviano.',
  ],
  evolution: [
    'El progreso no siempre se ve — pero se siente.',
    'Cada registro es una prueba de que seguiste intentando.',
    'Tu proceso no compite con el de nadie más.',
  ],
};

export function pickMantra(viewKey: string): string {
  const list = MANTRA_BANK[viewKey];
  if (!list || !list.length) return '';
  return list[Math.floor(Math.random() * list.length)];
}
