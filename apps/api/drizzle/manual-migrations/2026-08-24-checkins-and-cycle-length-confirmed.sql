-- Check-ins de baja fricción (Fase C, exclusivo Mentoría) — pulso diario y
-- reflexión semanal — más la marca de última confirmación de duración de
-- ciclo. This project has no automated DB migration system; run this SQL
-- manually against the dev and test Supabase databases via the SQL Editor.

ALTER TABLE personal_info ADD COLUMN IF NOT EXISTS cycle_length_confirmed_at timestamptz;

CREATE TABLE IF NOT EXISTS daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  pulso_animo integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (client_id, fecha)
);

CREATE TABLE IF NOT EXISTS weekly_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  semana_inicio date NOT NULL,
  estres_cronico integer NOT NULL,
  tecnicas_manejo_usadas text,
  despertares_nocturnos_semana text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (client_id, semana_inicio)
);
