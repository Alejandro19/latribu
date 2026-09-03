-- Manual migration for "Tips and tricks" de Nutrición (biblioteca global de tips,
-- gestionada por el admin, vista por todos los clientes con acceso al módulo).
-- This project has no automated DB migration system; run this SQL manually against
-- the dev and test Supabase databases via the SQL Editor.

CREATE TABLE IF NOT EXISTS nutrition_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
