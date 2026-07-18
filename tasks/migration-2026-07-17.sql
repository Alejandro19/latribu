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
