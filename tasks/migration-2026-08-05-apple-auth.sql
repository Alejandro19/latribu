-- Sign in with Apple: columna apple_id en admins y clients, igual patrón que google_id.
-- Login con Apple queda inactivo hasta configurar APPLE_CLIENT_ID en el backend.

ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "apple_id" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "apple_id" text;
