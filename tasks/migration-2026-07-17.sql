-- Migración pendiente: alinea la base real de Supabase con schema.sql
-- Ejecutar en Supabase SQL Editor. Todas las columnas son ADD COLUMN
-- (no destructivo, no borra ni modifica datos existentes).

ALTER TABLE anthropometric_records ADD COLUMN IF NOT EXISTS mes_num INT;
ALTER TABLE progress_photos ADD COLUMN IF NOT EXISTS mes_num INT;

ALTER TABLE bio_inbody_records
  ADD COLUMN IF NOT EXISTS version TEXT,
  ADD COLUMN IF NOT EXISTS peso_objetivo NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS grasa_visceral NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS bmr NUMERIC(6,0),
  ADD COLUMN IF NOT EXISTS angulo_fase NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS ecw_tbw NUMERIC(5,3),
  ADD COLUMN IF NOT EXISTS masa_osea NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS altura NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS mes_num INT;

-- Task 4: PDF de plan de alimentación
ALTER TABLE nutrition_plans
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_name TEXT;

-- Rediseño de "Mi Evolución": check-in mensual con métricas concretas
-- en vez de scores subjetivos (fuerza/ánimo/confianza/seguridad/energía).
ALTER TABLE evolution_checkins
  ADD COLUMN IF NOT EXISTS sleep_hours NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS adherence_pct INT CHECK (adherence_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS pain_flag BOOLEAN,
  ADD COLUMN IF NOT EXISTS pain_notes TEXT,
  ADD COLUMN IF NOT EXISTS stress_score INT CHECK (stress_score BETWEEN 1 AND 10);

-- Activación de módulos por cliente: los nuevos clientes ya no arrancan
-- con todos los módulos habilitados. Entrenamiento/nutrición/suplementación/
-- cortisol quedan bloqueados hasta que el admin asigne el primer contenido
-- (el backend los desbloquea automáticamente vía unlockModule()).
-- No afecta clientes ya existentes, solo el DEFAULT para nuevos inserts.
ALTER TABLE clients ALTER COLUMN permissions
  SET DEFAULT '{"training":false,"nutrition":false,"supplementation":false,"cortisol":false,"community":true,"evolution":true}';

-- Notificaciones para el admin (onboarding completado, etc.)
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'onboarding_complete',
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY deny_all ON admin_notifications USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipo de cliente: Coaching 1:1 / Coaching Online / Leads Wellness.
-- Lo define el admin al activar la cuenta. Leads Wellness solo acceden a
-- Gestión de Cortisol + Comunidad (permissions se ajusta en el endpoint
-- PATCH /api/clients/:id/client-type al clasificar).
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type TEXT
  CHECK (client_type IN ('coaching_1_1','coaching_online','lead_wellness'));

-- Membresía con fecha de inicio/fin (30 o 90 días), para retención:
-- si hoy > plan_end_date el cliente queda bloqueado (solo coaching_1_1/
-- coaching_online, los leads no tienen membresía). Renovación manual por
-- el admin vía PATCH /api/clients/:id/renew-plan al confirmar el pago.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS plan_duration_days INT CHECK (plan_duration_days > 0),
  ADD COLUMN IF NOT EXISTS plan_start_date DATE,
  ADD COLUMN IF NOT EXISTS plan_end_date DATE;

-- Fotos de progreso: se reemplazó el selector único "Ángulo" (frente/perfil/espalda)
-- por 4 campos fijos (Frente, Lado derecho, Lado izquierdo, Espalda). Se actualiza el
-- CHECK de la columna para aceptar los nuevos valores. NOT VALID: no revalida fotos ya
-- guardadas con angle='perfil' (quedan como están), solo aplica a inserts nuevos.
ALTER TABLE progress_photos DROP CONSTRAINT IF EXISTS progress_photos_angle_check;
ALTER TABLE progress_photos ADD CONSTRAINT progress_photos_angle_check
  CHECK (angle IN ('frente','lado_derecho','lado_izquierdo','espalda')) NOT VALID;

-- Rediseño del módulo Entrenamiento: días (Día 1, Día 2...) con 3 categorías
-- fijas por día (Warm Up / Cardio / Strength), en vez de la clasificación libre
-- Método+Sección de antes. Se mapea lo existente a categoría antes de borrar
-- las columnas viejas, y todo queda en "Día 1" por defecto (el admin reclasifica).
CREATE TABLE IF NOT EXISTS mindset_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote TEXT NOT NULL,
  author TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE mindset_quotes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY deny_all ON mindset_quotes USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS training_days INT CHECK (training_days BETWEEN 1 AND 7),
  ADD COLUMN IF NOT EXISTS assigned_quote_id UUID REFERENCES mindset_quotes(id) ON DELETE SET NULL;

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS day_number INT DEFAULT 1;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'strength';
UPDATE exercises SET category = CASE
    WHEN method = 'Cardio' OR section = 'Cardio' THEN 'cardio'
    WHEN section = 'Movilidad articular' THEN 'warmup'
    ELSE 'strength'
  END
  WHERE category IS NULL OR category = 'strength';
ALTER TABLE exercises ALTER COLUMN day_number SET NOT NULL;
ALTER TABLE exercises ALTER COLUMN category SET NOT NULL;
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_day_number_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_day_number_check CHECK (day_number BETWEEN 1 AND 7);
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_category_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_category_check CHECK (category IN ('warmup','cardio','strength'));
ALTER TABLE exercises DROP COLUMN IF EXISTS method;
ALTER TABLE exercises DROP COLUMN IF EXISTS section;

-- Cardio mide duración en vez de series/repeticiones.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS duration TEXT;

-- Nivel de disciplina: registro de "Día N" completado (calendario del cliente +
-- candado semanal: Día N+1 no se desbloquea hasta que Día N esté completado
-- dentro de la semana calendario actual, lunes a domingo).
CREATE TABLE IF NOT EXISTS training_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  day_number INT NOT NULL CHECK (day_number BETWEEN 1 AND 7),
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, day_number, completed_date)
);
ALTER TABLE training_completions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY deny_all ON training_completions USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Notificaciones para el cliente (ej. "Ahora tienes acceso a tu módulo de
-- nutrición" cuando el admin le asigna contenido por primera vez).
CREATE TABLE IF NOT EXISTS client_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE client_notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY deny_all ON client_notifications USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- PDF/foto original del reporte InBody, para que el admin lo pueda ver y
-- descargar desde la ficha del cliente (antes solo se guardaban los valores
-- extraídos por OCR, no el archivo original).
ALTER TABLE bio_inbody_records
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT;

-- Datos de la plantilla estándar del PDF "Plan nutricional" (resumen del
-- mentor, menú con Opción 1/Opción 2 por comida, recomendaciones y mensaje
-- de cierre) — independientes de la tabla `meals` (que sigue alimentando la
-- tarjeta de macros y el hero de "próxima comida" en pantalla).
ALTER TABLE nutrition_plans
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS menu_plan JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recommendations JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS closing_message TEXT;

-- Seguimiento de constancia para Gestión de Cortisol: un chulito por día en
-- que el cliente marcó como reproducida/completada su técnica, para poder
-- mostrar un calendario de constancia igual al de "Nivel de disciplina" en
-- Entrenamiento.
CREATE TABLE IF NOT EXISTS cortisol_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  technique_id UUID REFERENCES cortisol_techniques(id) ON DELETE SET NULL,
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, completed_date)
);
ALTER TABLE cortisol_completions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY deny_all ON cortisol_completions USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Check-in emocional de una sola selección por día, para recomendar
-- dinámicamente la técnica del hero de Gestión de Cortisol.
CREATE TABLE IF NOT EXISTS cortisol_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  emotion TEXT NOT NULL CHECK (emotion IN ('ansioso','irritable','cansado','abrumado','tranquilo','energia')),
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, checkin_date)
);
ALTER TABLE cortisol_checkins ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY deny_all ON cortisol_checkins USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Banco de tips educativos ("Sabías que...") administrado por el admin desde
-- el propio módulo Gestión de Cortisol; se asignan al azar entre los activos.
CREATE TABLE IF NOT EXISTS cortisol_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cortisol_tips ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY deny_all ON cortisol_tips USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Un cliente nuevo sin clasificar nunca debe quedar en NULL (equivalía a
-- comportarse como coaching, el nivel de acceso más alto, por accidente).
-- El valor por defecto y más restringido es lead_wellness.
UPDATE clients SET client_type = 'lead_wellness' WHERE client_type IS NULL;
ALTER TABLE clients ALTER COLUMN client_type SET DEFAULT 'lead_wellness';
ALTER TABLE clients ALTER COLUMN client_type SET NOT NULL;

-- Descanso: protocolo de sueño personalizado escrito por el mentor. Solo
-- aplica a clientes con plan activo (coaching_1_1/coaching_online) — para
-- lead_wellness se sigue mostrando el protocolo genérico de 4 pilares.
-- Un solo campo de texto libre (no una recomendación por pilar) para que el
-- mentor escriba el protocolo como quiera, sin estructura rígida.
CREATE TABLE IF NOT EXISTS sleep_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  protocol_text TEXT,
  sleep_window TEXT,
  supplement TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sleep_protocols ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY deny_all ON sleep_protocols USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Fix: la tabla sleep_protocols ya se había creado con el esquema viejo por
-- pilar (mentor_note/tip_light/...) antes de simplificarla a un solo campo
-- de texto libre. CREATE TABLE IF NOT EXISTS no la actualizó, así que hay
-- que migrar las columnas explícitamente.
ALTER TABLE sleep_protocols ADD COLUMN IF NOT EXISTS protocol_text TEXT;
UPDATE sleep_protocols SET protocol_text = mentor_note WHERE protocol_text IS NULL AND mentor_note IS NOT NULL;
ALTER TABLE sleep_protocols DROP COLUMN IF EXISTS mentor_note;
ALTER TABLE sleep_protocols DROP COLUMN IF EXISTS tip_light;
ALTER TABLE sleep_protocols DROP COLUMN IF EXISTS tip_temperature;
ALTER TABLE sleep_protocols DROP COLUMN IF EXISTS tip_consistency;
ALTER TABLE sleep_protocols DROP COLUMN IF EXISTS tip_digital_sunset;

-- Mi Evolución — "Tu evolución física": récords personales configurables
-- por el mentor (no autoreportados) y fecha de próxima medición en persona.
CREATE TABLE IF NOT EXISTS personal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  initial_value TEXT,
  current_value TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY deny_all ON personal_records USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS next_checkin_date DATE;

-- Herramientas para dormir (Descanso): banco global editable por el admin,
-- reemplaza el array hardcodeado REST_TOOLS. Se auto-siembra con los 3
-- valores por defecto la primera vez que se pide (ver GET /api/rest-tools).
CREATE TABLE IF NOT EXISTS rest_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  meta TEXT,
  action TEXT NOT NULL DEFAULT 'play' CHECK (action IN ('play','write')),
  minutes INT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rest_tools ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY deny_all ON rest_tools USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Audio propio por herramienta para dormir (el admin sube un archivo real
-- que se reproduce al darle clic en "Reproducir", en vez del temporizador
-- silencioso que había antes).
ALTER TABLE rest_tools ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE rest_tools ADD COLUMN IF NOT EXISTS audio_name TEXT;

-- Duración exacta del audio (minutos + segundos), ya que muchos audios no
-- duran un número redondo de minutos.
ALTER TABLE rest_tools ADD COLUMN IF NOT EXISTS seconds INT;

-- Gestión de Cortisol: mismo campo de audio propio + duración en min:seg
-- que ya tiene Descanso, aplicado a "Asignar técnica".
ALTER TABLE cortisol_techniques ADD COLUMN IF NOT EXISTS duration_minutes INT;
ALTER TABLE cortisol_techniques ADD COLUMN IF NOT EXISTS duration_seconds INT;
ALTER TABLE cortisol_techniques ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE cortisol_techniques ADD COLUMN IF NOT EXISTS audio_name TEXT;

-- Login con Google: clientes creados desde Google Sign-In no tienen
-- contraseña propia, por eso password_hash deja de ser obligatorio en
-- clients. google_id queda como referencia de vinculación de cuenta en
-- ambas tablas (no se usa para autenticar, el match real es por email).
ALTER TABLE clients ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS google_id TEXT;

-- Registro rápido de sueño del hero de Descanso: reemplaza el hero anterior
-- (que leía sleep_hours del check-in mensual de Mi Evolución) por un
-- registro diario propio, de un toque, independiente de evolution_checkins.
CREATE TABLE IF NOT EXISTS sleep_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  hours NUMERIC(3,1) NOT NULL,
  quality INT NOT NULL CHECK (quality BETWEEN 1 AND 5),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, date)
);
ALTER TABLE sleep_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY deny_all ON sleep_logs USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Confirmación de asistencia vía NFC + racha semanal + protector (Entrenamiento).
ALTER TABLE training_completions ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
DO $$ BEGIN
  ALTER TABLE training_completions ADD CONSTRAINT training_completions_source_check CHECK (source IN ('manual','nfc'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS training_protector_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, week_start)
);
ALTER TABLE training_protector_uses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY deny_all ON training_protector_uses USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
