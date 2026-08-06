-- Migración para Mi Evolución. Idempotente (seguro re-correr).
-- Ejecutar en Supabase SQL Editor de producción.

CREATE TABLE IF NOT EXISTS evolution_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  strength_score INT CHECK (strength_score BETWEEN 1 AND 10),
  mood_score INT CHECK (mood_score BETWEEN 1 AND 10),
  confidence_score INT CHECK (confidence_score BETWEEN 1 AND 10),
  security_score INT CHECK (security_score BETWEEN 1 AND 10),
  energy_score INT CHECK (energy_score BETWEEN 1 AND 10),
  notes TEXT,
  sleep_hours NUMERIC(3,1),
  adherence_pct INT CHECK (adherence_pct BETWEEN 0 AND 100),
  pain_flag BOOLEAN,
  pain_notes TEXT,
  stress_score INT CHECK (stress_score BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  initial_value TEXT,
  current_value TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS next_checkin_date DATE;

-- RLS
ALTER TABLE evolution_checkins ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY deny_all ON evolution_checkins USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY deny_all ON personal_records USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
