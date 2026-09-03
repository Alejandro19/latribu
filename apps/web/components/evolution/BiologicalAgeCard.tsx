'use client';

import useSWR from 'swr';
import { listLabPanels } from '../../lib/lab-panels-client';
import MetricValue from '../ui/MetricValue';

// Ephi-Metrics · Edad Biológica (PhenoAge, Levine et al. 2018) — ver
// biological-age.service.ts. Deliberadamente NO se muestran acá "Ritmo de
// envejecimiento" ni "Ancho de banda cognitivo" (fuera de alcance de esta
// entrega). Nunca usar el término "Edad epigenética" — es una tecnología y
// un concepto científico distintos.
export function BiologicalAgeCard({ clientId }: { clientId: string }) {
  const { data: panels } = useSWR(['lab-panels', clientId], () => listLabPanels(clientId));

  if (!panels) return null;

  // El checkpoint aprobado más reciente que efectivamente tiene Edad
  // Biológica calculada (requiere los 9 marcadores de PhenoAge completos —
  // ver hasCompletePhenoAgeMarkers). Nunca se aproxima ni se muestra un 0
  // fantasma cuando no hay un panel así.
  const latest = panels
    .filter((p) => p.status === 'aprobado' && p.edadBiologica != null && p.edadCronologicaCalculo != null)
    .sort((a, b) => b.semanaNumero - a.semanaNumero)[0];

  return (
    <section className="border p-6 mb-5" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
      <span className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--eph-steel)' }}>
        Edad biológica
      </span>
      {latest ? (
        <div className="mt-3">
          <MetricValue value={latest.edadBiologica!.toFixed(1)} unit="años" size="index" />
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--eph-muted)' }}>
            Edad cronológica: {latest.edadCronologicaCalculo} años
          </p>
        </div>
      ) : (
        <p className="mt-3 font-body text-[13px]" style={{ color: 'var(--eph-muted)' }}>
          Aún no tienes un laboratorio aprobado con los 9 biomarcadores necesarios (Albúmina, Creatinina, Glucosa,
          PCR, % Linfocitos, VCM, RDW, Fosfatasa Alcalina y Leucocitos) para calcular tu Edad Biológica.
        </p>
      )}
    </section>
  );
}
