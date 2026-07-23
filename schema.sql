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
  google_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Biblioteca de frases de mentalidad (módulo Entrenamiento). Pool global que
-- administra el admin; opcionalmente se puede fijar una frase puntual por
-- cliente (ver clients.assigned_quote_id).
CREATE TABLE mindset_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote TEXT NOT NULL,
  author TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  plan TEXT NOT NULL DEFAULT 'Miembro',
  client_type TEXT NOT NULL DEFAULT 'lead_wellness' CHECK (client_type IN ('coaching_1_1','coaching_online','lead_wellness')),
  -- Membresía: solo aplica a coaching_1_1/coaching_online (no a leads).
  -- Se renueva manualmente por el admin cuando confirma el pago (fuera del
  -- sistema); si hoy > plan_end_date, el cliente queda bloqueado.
  plan_duration_days INT CHECK (plan_duration_days > 0),
  plan_start_date DATE,
  plan_end_date DATE,
  permissions JSONB NOT NULL DEFAULT '{"training":false,"nutrition":false,"supplementation":false,"cortisol":false,"community":true,"evolution":true}',
  -- Módulo Entrenamiento: cantidad de días de entrenamiento a la semana que el
  -- admin le asigna al cliente (define cuántos botones "Día N" ve en la app).
  training_days INT CHECK (training_days BETWEEN 1 AND 7),
  -- Frase de mentalidad fija asignada por el admin a este cliente en particular
  -- (si es NULL, ve una frase aleatoria del pool global de mindset_quotes).
  assigned_quote_id UUID REFERENCES mindset_quotes(id) ON DELETE SET NULL,
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
  mes_num INT,
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
  angle TEXT CHECK (angle IN ('frente','lado_derecho','lado_izquierdo','espalda')),
  photo_url TEXT NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  mes_num INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 4. ENTRENAMIENTO (mismas funciones que BIO360)
-- ------------------------------------------------------------

CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  day_number INT NOT NULL DEFAULT 1 CHECK (day_number BETWEEN 1 AND 7),
  category TEXT NOT NULL DEFAULT 'strength' CHECK (category IN ('warmup','cardio','strength')),
  series INT DEFAULT 3,
  reps TEXT,
  duration TEXT, -- solo aplica a category='cardio' (reemplaza series/reps para ese caso)
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

-- Notificaciones para el cliente (ej. "Ahora tienes acceso a tu módulo de
-- nutrición" cuando el admin le asigna contenido por primera vez a un módulo).
CREATE TABLE client_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registro de "Día N" de entrenamiento completado (todas sus categorías con
-- ejercicios asignados terminadas). Alimenta el calendario "Nivel de
-- disciplina" y el candado semanal (Día N+1 no se desbloquea hasta que Día N
-- tenga un registro con completed_date dentro de la semana calendario actual).
CREATE TABLE training_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  day_number INT NOT NULL CHECK (day_number BETWEEN 1 AND 7),
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, day_number, completed_date)
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
  pdf_url TEXT,
  pdf_name TEXT,
  summary TEXT,
  menu_plan JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  closing_message TEXT,
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

-- Seguimiento de constancia: un chulito por día en que el cliente marcó como
-- reproducida/completada su técnica de cortisol (igual que training_completions,
-- pero sin day_number ya que aquí no hay días de la semana asignados).
CREATE TABLE cortisol_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  technique_id UUID REFERENCES cortisol_techniques(id) ON DELETE SET NULL,
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, completed_date)
);

-- Check-in emocional de una sola selección por día ("¿Cómo te sientes ahora
-- mismo?"), usado para recomendar dinámicamente la técnica del hero.
CREATE TABLE cortisol_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  emotion TEXT NOT NULL CHECK (emotion IN ('ansioso','irritable','cansado','abrumado','tranquilo','energia')),
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, checkin_date)
);

-- Banco de tips educativos ("Sabías que...") que el admin administra desde el
-- propio módulo Gestión de Cortisol; se asignan al azar entre los activos.
CREATE TABLE cortisol_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Herramientas para dormir (Descanso): banco global editable por el admin
-- (no por cliente), igual que mindset_quotes/cortisol_tips. "play" usa el
-- temporizador real (minutes); "write" abre el diario de descarga mental.
CREATE TABLE rest_tools (
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Descanso: protocolo de sueño personalizado, escrito por el mentor.
-- Solo aplica a clientes con plan activo (coaching_1_1 / coaching_online) —
-- para lead_wellness se muestra siempre el protocolo genérico de 4 pilares,
-- nunca esta tarjeta (son mutuamente excluyentes en el frontend).
-- ------------------------------------------------------------
CREATE TABLE sleep_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  protocol_text TEXT,
  sleep_window TEXT,
  supplement TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
  sleep_hours NUMERIC(3,1),
  adherence_pct INT CHECK (adherence_pct BETWEEN 0 AND 100),
  pain_flag BOOLEAN,
  pain_notes TEXT,
  stress_score INT CHECK (stress_score BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registro rápido de sueño (hero de Descanso) — un toque, sin salir de la
-- pantalla. Es intencionalmente independiente de evolution_checkins (el
-- check-in mensual completo de Mi Evolución): aquí una fila por cliente
-- por día, editable mientras siga siendo "hoy".
CREATE TABLE sleep_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  hours NUMERIC(3,1) NOT NULL,
  quality INT NOT NULL CHECK (quality BETWEEN 1 AND 5),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, date)
);

-- Registros InBody, cargados y parseados desde el módulo 3 dentro de
-- Información Personal (mismo flujo de OCR que BIO360: /api/clients/:id/ocr-vision
-- + parseo en el frontend), para poder comparar el progreso a futuro.
CREATE TABLE bio_inbody_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  fecha DATE,
  version TEXT,
  peso_total NUMERIC(5,1),
  smm NUMERIC(5,1),
  grasa_pct NUMERIC(4,1),
  imc NUMERIC(4,1),
  peso_objetivo NUMERIC(5,1),
  grasa_visceral NUMERIC(4,1),
  bmr NUMERIC(6,0),
  angulo_fase NUMERIC(4,2),
  ecw_tbw NUMERIC(5,3),
  masa_osea NUMERIC(4,2),
  altura NUMERIC(5,1),
  mes_num INT,
  file_url TEXT, -- PDF/foto original del reporte InBody que subió el cliente
  file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Récords personales de Mi Evolución ("Tu evolución física"): lista de
-- ejercicios configurable por el mentor, con progreso inicial → actual.
-- No autoreportado por el cliente — lo ingresa el admin en cada seguimiento.
CREATE TABLE personal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  initial_value TEXT,
  current_value TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fecha de la próxima medición/seguimiento en persona con el mentor. La
-- agenda el admin manualmente; se omite en pantalla si no está definida.
ALTER TABLE clients ADD COLUMN next_checkin_date DATE;

-- ------------------------------------------------------------
-- 10. NOTIFICACIONES PARA EL ADMIN
--     Se crea una fila cuando un cliente completa su onboarding
--     (Información Personal). El admin las revisa y marca leídas.
-- ------------------------------------------------------------

CREATE TABLE admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'onboarding_complete',
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
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
    'evolution_checkins','bio_inbody_records','admin_notifications','mindset_quotes','training_completions','client_notifications','sleep_logs'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY deny_all ON %I USING (false);', t);
  END LOOP;
END $$;
