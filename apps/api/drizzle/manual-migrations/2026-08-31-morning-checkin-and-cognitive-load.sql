-- Check-in matutino de autorreporte (reemplaza la fuente inexistente de
-- "Cortisol AM") + historial de Carga Cognitiva diaria + flag de ritual en
-- las técnicas de cortisol ("The Rox Ritual" reutiliza el sistema de
-- técnicas existente en vez de uno nuevo). This project has no automated
-- DB migration system; run this SQL manually against the dev and test
-- Supabase databases via the SQL Editor.

-- 3 preguntas 1-5 (energía, tensión, claridad), una vez por día por
-- cliente. activacion_matutina es el score derivado (0-10), calculado y
-- guardado en el momento del check-in — ver morning-checkin.service.ts.
-- Un día sin respuesta simplemente no tiene fila (nunca se rellena).
CREATE TABLE IF NOT EXISTS morning_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  energia integer NOT NULL,
  tension integer NOT NULL,
  claridad integer NOT NULL,
  activacion_matutina numeric(4,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, fecha)
);

CREATE INDEX IF NOT EXISTS morning_checkins_client_id_idx ON morning_checkins(client_id);

-- Score diario 0-10, calculado por el job nocturno (cognitive-load.service.ts)
-- a partir de HRV/Activación Matutina/Recuperación%/Sleep score. El umbral
-- sostenible (percentil 75) y el contador de días consecutivos por encima
-- se calculan en lectura a partir de esta tabla — no se guardan aparte,
-- para no arriesgar un umbral cacheado desincronizado del historial real.
CREATE TABLE IF NOT EXISTS cognitive_load_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  score numeric(4,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, fecha)
);

CREATE INDEX IF NOT EXISTS cognitive_load_history_client_id_idx ON cognitive_load_history(client_id);

ALTER TABLE cortisol_techniques ADD COLUMN IF NOT EXISTS is_ritual boolean NOT NULL DEFAULT false;
