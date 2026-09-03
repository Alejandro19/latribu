-- Migración manual para Gestión de Cortisol (cortisol_techniques, cortisol_completions,
-- cortisol_checkins, cortisol_tips). Correr en el Supabase SQL Editor de producción.
-- Idempotente (seguro re-correr).

CREATE TABLE IF NOT EXISTS cortisol_techniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('Respiración','Breathwork','Meditación','Mindfulness')),
  duration TEXT,
  duration_minutes INT,
  duration_seconds INT,
  description TEXT,
  video_url TEXT,
  video_name TEXT,
  youtube_url TEXT,
  audio_url TEXT,
  audio_name TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cortisol_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  technique_id UUID REFERENCES cortisol_techniques(id) ON DELETE SET NULL,
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, completed_date)
);

CREATE TABLE IF NOT EXISTS cortisol_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  emotion TEXT NOT NULL CHECK (emotion IN ('ansioso','irritable','cansado','abrumado','tranquilo','energia')),
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, checkin_date)
);

CREATE TABLE IF NOT EXISTS cortisol_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
