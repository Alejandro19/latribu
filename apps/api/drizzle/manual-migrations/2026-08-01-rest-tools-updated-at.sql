-- Manual migration for the "Descanso — Herramientas para Dormir (Rest Tools)" feature (Task 1).
-- Adds the missing updated_at column to rest_tools table.
-- This project has no automated DB migration system; run this SQL manually against the
-- test/production Supabase database via the SQL Editor if the table was created without it.

ALTER TABLE rest_tools ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
