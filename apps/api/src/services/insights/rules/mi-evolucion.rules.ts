// Mi Evolución — Matriz_Reglas_Mentoria_BIO360.md.
//
// Solo MEV-01 se implementa como una `Rule` de este módulo (es la única que
// produce un insight propio, de consolidación). Las demás son reglas de
// sistema transversales, ya implementadas en otro lugar — no duplicarlas:
//   MEV-02 (válido hasta el próximo checkpoint) → RuleResult.validoHastaProximoCheckpoint,
//     seteado por cada regla que depende de `panels` (ver cortisol/sueno/etc.).
//   MEV-03 (rango correcto por género/edad) → rango-optimo.ts, resolverRangoOptimo().
//   MEV-04 (supresión por fase lútea) → engine.ts, aplicado sobre CORT-01/ENT-02.
//   MEV-05 (fase de ciclo como contexto) → InsightsResult.fase, ya calculado
//     por fase-ciclo.ts y expuesto a nivel de respuesta completa, no por módulo.
import type { Rule } from '../types.js';

export const miEvolucionRules: Rule[] = [
  {
    id: 'MEV-01',
    evaluar(ctx) {
      if (ctx.panels.length < 2) return null;
      const checkpoints = ctx.panels.map((p) => p.semanaNumero).join(' → ');
      return {
        id: 'MEV-01',
        tipo: 'optimizar',
        mensaje: `Tablero longitudinal disponible (checkpoints ${checkpoints}) — vista para revisión en sesión 1:1.`,
      };
    },
  },
];
