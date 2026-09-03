-- Manual migration for the "Entrenamiento — Frases y Frases de Mentalidad" feature (Tasks 1-2).
-- This project has no automated DB migration system; run this SQL manually against the
-- production Supabase database via the SQL Editor before this feature is used there.
-- IF NOT EXISTS guards make it safe to re-run even if partially applied already.

CREATE TABLE IF NOT EXISTS mindset_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote text NOT NULL,
  author text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_quote_id uuid;
