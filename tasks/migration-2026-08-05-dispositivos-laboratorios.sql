-- Módulo "Dispositivos y Laboratorios" (solo cliente tipo Mentoring):
-- wearables (Garmin/WHOOP/Oura/Polar) + laboratorios clínicos vía OCR.
-- Fiel a las tablas wearable_tokens / wearable_metricas / paneles_laboratorio
-- de BIO360, adaptadas a la convención de nombres del proyecto nuevo.

CREATE TABLE IF NOT EXISTS "wearable_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "dispositivo" text NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text,
  "token_expires_at" timestamptz,
  "garmin_user_id" text,
  "whoop_user_id" text,
  "oura_user_id" text,
  "polar_user_id" text,
  "connected_at" timestamptz DEFAULT now(),
  "last_sync_at" timestamptz,
  "updated_at" timestamptz DEFAULT now(),
  UNIQUE ("client_id", "dispositivo")
);

CREATE TABLE IF NOT EXISTS "wearable_metricas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "dispositivo" text NOT NULL,
  "fecha" date NOT NULL,
  "fc_reposo" integer,
  "hrv_nocturno" integer,
  "sueno_total_minutos" integer,
  "sueno_profundo_minutos" integer,
  "sueno_rem_minutos" integer,
  "sueno_ligero_minutos" integer,
  "sueno_score" integer,
  "sueno_performance" integer,
  "recovery_score" integer,
  "readiness_score" integer,
  "body_battery_max" integer,
  "estres_promedio" integer,
  "spo2" numeric(4,1),
  "vo2max" numeric(4,1),
  "tasa_respiratoria" numeric(4,1),
  "pasos" integer,
  "calorias_activas" integer,
  "strain_score" numeric(4,1),
  "temperatura_piel" numeric(4,2),
  "hora_dormir" timestamptz,
  "hora_despertar" timestamptz,
  "raw_data" jsonb DEFAULT '{}',
  "created_at" timestamptz DEFAULT now(),
  UNIQUE ("client_id", "dispositivo", "fecha")
);

CREATE TABLE IF NOT EXISTS "lab_panels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "semana_numero" integer NOT NULL,
  "fecha" date,
  "datos" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  UNIQUE ("client_id", "semana_numero")
);

ALTER TABLE "wearable_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wearable_metricas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_panels" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deny_all ON "wearable_tokens";
CREATE POLICY deny_all ON "wearable_tokens" FOR ALL USING (false);
DROP POLICY IF EXISTS deny_all ON "wearable_metricas";
CREATE POLICY deny_all ON "wearable_metricas" FOR ALL USING (false);
DROP POLICY IF EXISTS deny_all ON "lab_panels";
CREATE POLICY deny_all ON "lab_panels" FOR ALL USING (false);

-- Nuevo tipo de cliente "mentoring" — el check constraint de clients.client_type
-- solo permitía coaching_1_1/coaching_online/lead_wellness.
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_client_type_check";
ALTER TABLE "clients" ADD CONSTRAINT "clients_client_type_check"
  CHECK (client_type = ANY (ARRAY['coaching_1_1'::text, 'coaching_online'::text, 'lead_wellness'::text, 'mentoring'::text]));
