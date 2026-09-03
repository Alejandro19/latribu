-- Manual migration for the "Descanso — Herramientas para Dormir (Rest Tools)" feature (review fix).
-- Enforces NOT NULL on rest_tools.sort_order to match the Drizzle schema (models/schema.ts),
-- which already declares sortOrder as notNull().default(0).
-- This project has no automated DB migration system; run this SQL manually against the
-- test/production Supabase database via the SQL Editor if the table was created without it.

UPDATE rest_tools SET sort_order = 0 WHERE sort_order IS NULL;
ALTER TABLE rest_tools ALTER COLUMN sort_order SET NOT NULL;
