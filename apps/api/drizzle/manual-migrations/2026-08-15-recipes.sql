-- Manual migration for "Recetas saludables" de Nutrición (biblioteca global de PDFs,
-- subidos por el admin, vistos/descargados por todos los clientes con acceso al módulo).
-- This project has no automated DB migration system; run this SQL manually against
-- the dev and test Supabase databases via the SQL Editor.

CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  pdf_url text NOT NULL,
  pdf_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
