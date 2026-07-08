-- ============================================================
-- LA TRIBU — Esquema de base de datos (Supabase / PostgreSQL)
-- Basado en la arquitectura de BIO360, simplificado.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. IDENTIDAD Y ROLES
-- ------------------------------------------------------------

CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Administrador',
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  plan TEXT NOT NULL DEFAULT 'Miembro',
  permissions JSONB NOT NULL DEFAULT '{"training":true,"nutrition":true,"supplementation":true,"cortisol":true,"community":true,"evolution":true}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2. INFORMACIÓN PERSONAL (módulos 1-9 de BIO360, sin módulo 10)
--    Campos estructurados básicos + JSONB con el resto de
--    respuestas del onboarding (mismo patrón, menos tablas).
-- ------------------------------------------------------------

CREATE TABLE personal_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Módulo 1: Perfil Personal
  birthdate DATE,
  gender TEXT,
  occupation TEXT,
  country TEXT,
  city TEXT,
  phone_code TEXT DEFAULT '+52',
  phone_number TEXT,
  marital_status TEXT,

  -- Módulo 3: Composición Corporal (datos base; ver anthropometric_records para histórico)
  weight NUMERIC(5,1),
  height NUMERIC(5,1),
  body_fat NUMERIC(4,1),

  -- Módulos 2, 4-9: se guarda el resto de respuestas del onboarding como JSON
  -- (vida profesional, historial de salud, alimentación, sueño, energía/cognición,
  --  estrés/emociones, entrenamiento físico)
  onboarding_report JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id)
);

-- ------------------------------------------------------------
-- 3. COMPOSICIÓN CORPORAL: fotos + medidas antropométricas
--    (funcionalidad nueva pedida en el brief, serie temporal
--    para poder comparar progreso a futuro)
-- ------------------------------------------------------------

CREATE TABLE anthropometric_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  semana INT,
  peso NUMERIC(5,1),
  cintura NUMERIC(5,1),
  brazos NUMERIC(5,1),
  hombros NUMERIC(5,1),
  piernas NUMERIC(5,1),
  gluteo NUMERIC(5,1),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  anthropometric_record_id UUID REFERENCES anthropometric_records(id) ON DELETE CASCADE,
  angle TEXT CHECK (angle IN ('frente','perfil','espalda')),
  photo_url TEXT NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 4. ENTRENAMIENTO (mismas funciones que BIO360)
-- ------------------------------------------------------------

CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('Fuerza','HIIT','Funcional','Cardio','Movilidad')),
  section TEXT DEFAULT 'Entrenamiento de fuerza' CHECK (section IN ('Movilidad articular','Entrenamiento de fuerza','Estiramientos','Cardio')),
  series INT DEFAULT 3,
  reps TEXT,
  rest_time TEXT,
  description TEXT,
  recommendations TEXT,
  video_url TEXT,
  video_name TEXT,
  youtube_url TEXT,
  video_visible BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 5. NUTRICIÓN (mismas funciones que BIO360)
--    El admin carga el plan de alimentación / protocolos.
-- ------------------------------------------------------------

CREATE TABLE nutrition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  daily_cals INT DEFAULT 0,
  protein_g INT DEFAULT 0,
  carbs_g INT DEFAULT 0,
  fat_g INT DEFAULT 0,
  notes TEXT,
  client_observations TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id)
);

CREATE TABLE meals (
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

-- ------------------------------------------------------------
-- 6. SUPLEMENTACIÓN (mismas funciones que Neuro Stacking BIO360)
--    El admin asigna los suplementos.
-- ------------------------------------------------------------

CREATE TABLE supplements (
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

-- ------------------------------------------------------------
-- 7. GESTIÓN DE CORTISOL (mismas funciones que BIO360)
--    El admin asigna las técnicas de gestión de cortisol.
-- ------------------------------------------------------------

CREATE TABLE cortisol_techniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('Respiración','Breathwork','Meditación','Mindfulness')),
  duration TEXT,
  description TEXT,
  video_url TEXT,
  video_name TEXT,
  youtube_url TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 8. COMUNIDAD: Eventos + Terapias
-- ------------------------------------------------------------

CREATE TABLE community_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ,
  location TEXT,
  capacity INT,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada','cancelada')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, client_id)
);

CREATE TABLE community_therapies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  discount_pct INT DEFAULT 0,
  provider TEXT,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE therapy_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapy_id UUID NOT NULL REFERENCES community_therapies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada','cancelada')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(therapy_id, client_id)
);

-- ------------------------------------------------------------
-- 9. MI EVOLUCIÓN: KPIs de progreso subjetivo
--    (fuerza, estado de ánimo, confianza, seguridad, energía)
--    Se cruza con anthropometric_records / bio_inbody para el
--    dashboard de evolución.
-- ------------------------------------------------------------

CREATE TABLE evolution_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  strength_score INT CHECK (strength_score BETWEEN 1 AND 10),
  mood_score INT CHECK (mood_score BETWEEN 1 AND 10),
  confidence_score INT CHECK (confidence_score BETWEEN 1 AND 10),
  security_score INT CHECK (security_score BETWEEN 1 AND 10),
  energy_score INT CHECK (energy_score BETWEEN 1 AND 10),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Opcional: registros InBody/DEXA si se quiere reutilizar el flujo
-- de biomarcadores de BIO360 en el dashboard de evolución.
CREATE TABLE bio_inbody_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  fecha DATE,
  peso_total NUMERIC(5,1),
  smm NUMERIC(5,1),
  grasa_pct NUMERIC(4,1),
  imc NUMERIC(4,1),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Mismo patrón que BIO360: RLS activo con policy deny_all;
-- todo el acceso pasa por el backend usando la service_role key.
-- ------------------------------------------------------------

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'admins','clients','personal_info','anthropometric_records','progress_photos',
    'exercises','nutrition_plans','meals','supplements','cortisol_techniques',
    'community_events','event_reservations','community_therapies','therapy_reservations',
    'evolution_checkins','bio_inbody_records'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY deny_all ON %I USING (false);', t);
  END LOOP;
END $$;
