-- Manual migration: adds cedula and email to personal_info.
-- "cedula" ya estaba declarada en schema.ts pero nunca se creó en la base de
-- datos real (sin migración previa) — quedó huérfana hasta ahora.
-- This project has no automated DB migration system; run this SQL manually against the
-- test/production Supabase database via the SQL Editor.

ALTER TABLE personal_info ADD COLUMN IF NOT EXISTS cedula text;
ALTER TABLE personal_info ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE personal_info ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE personal_info ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE personal_info ADD COLUMN IF NOT EXISTS id_type text;
