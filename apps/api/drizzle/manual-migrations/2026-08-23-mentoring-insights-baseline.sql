-- Manual migration: baseline nuevo para el motor de insights cruzados de
-- Mentoría (ver Matriz_Reglas_Mentoria_BIO360.md). Salud hormonal (Módulo 1)
-- y apnea del sueño (Módulo 6) en personal_info; día del ciclo del panel
-- (P6, Módulo 10) en lab_panels.
-- This project has no automated DB migration system; run this SQL manually against the
-- test/production Supabase database via the SQL Editor.

ALTER TABLE personal_info ADD COLUMN IF NOT EXISTS hormonal_status text;
ALTER TABLE personal_info ADD COLUMN IF NOT EXISTS hormonal_status_other text;
ALTER TABLE personal_info ADD COLUMN IF NOT EXISTS last_period_date date;
ALTER TABLE personal_info ADD COLUMN IF NOT EXISTS cycle_length_days integer;
ALTER TABLE personal_info ADD COLUMN IF NOT EXISTS snores text;
ALTER TABLE personal_info ADD COLUMN IF NOT EXISTS sleep_apnea_signs text;

ALTER TABLE lab_panels ADD COLUMN IF NOT EXISTS dia_ciclo_panel integer;
