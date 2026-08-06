-- Migración manual para Alimentación (nutrition_plans, meals) y Suplementación (supplements)
-- Correr en el Supabase SQL Editor de producción. Idempotente (seguro re-correr).

CREATE TABLE IF NOT EXISTS nutrition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  daily_cals INT DEFAULT 0,
  protein_g INT DEFAULT 0,
  carbs_g INT DEFAULT 0,
  fat_g INT DEFAULT 0,
  notes TEXT,
  client_observations TEXT,
  pdf_url TEXT,
  pdf_name TEXT,
  summary TEXT,
  menu_plan JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  closing_message TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id)
);

CREATE TABLE IF NOT EXISTS meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  meal_time TEXT NOT NULL,
  name TEXT NOT NULL,
  calories INT DEFAULT 0,
  protein_g INT DEFAULT 0,
  carbs_g INT DEFAULT 0,
  fat_g INT DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  dose TEXT,
  timing TEXT,
  benefit TEXT,
  category TEXT CHECK (category IN ('Nootrópico','Adaptógeno','Sueño','Rendimiento','Base')),
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
