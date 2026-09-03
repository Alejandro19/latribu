-- Diferenciación Mentoría: (1) Neurowellness — nota de precaución en las
-- técnicas de cortisol; (2) captura silenciosa de benchmark comparativo
-- anonimizado al cerrarse cada snapshot semana 0/6/12.

ALTER TABLE cortisol_techniques ADD COLUMN IF NOT EXISTS precaution_note text;

ALTER TABLE personal_info ADD COLUMN IF NOT EXISTS cargo_type text;
ALTER TABLE personal_info ADD COLUMN IF NOT EXISTS sector text;

-- Deliberadamente SIN client_id ni ningún otro campo identificable — ver
-- comentario en apps/api/src/models/schema.ts (mentoringBenchmarkSnapshots).
CREATE TABLE IF NOT EXISTS mentoring_benchmark_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_numero integer NOT NULL,
  age_band text NOT NULL,
  cargo_type text NOT NULL,
  sector text NOT NULL,
  markers jsonb NOT NULL DEFAULT '{}',
  wearable jsonb NOT NULL DEFAULT '{}',
  captured_at timestamptz DEFAULT now()
);
