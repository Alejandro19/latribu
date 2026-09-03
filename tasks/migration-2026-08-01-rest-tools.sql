-- Migración manual para Descanso — Herramientas para Dormir (Rest Tools)
-- Correr en el Supabase SQL Editor de producción. Idempotente (seguro re-correr).

CREATE TABLE IF NOT EXISTS rest_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  meta TEXT,
  action TEXT NOT NULL DEFAULT 'play' CHECK (action IN ('play','write')),
  minutes INT,
  seconds INT,
  audio_url TEXT,
  audio_name TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Por si la tabla ya existía sin estas columnas/constraints (fix de revisión final):
ALTER TABLE rest_tools ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE rest_tools SET sort_order = 0 WHERE sort_order IS NULL;
ALTER TABLE rest_tools ALTER COLUMN sort_order SET NOT NULL;
