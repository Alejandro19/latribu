-- Módulo de cuenta (PanelConfiguracion): foto de perfil, preferencias de
-- notificación y solicitud de eliminación de cuenta — las tres cosas que no
-- existían aún sobre `clients`. This project has no automated DB migration
-- system; run this SQL manually against the dev and test Supabase databases
-- via the SQL Editor (or the disposable tsx script used during development).

ALTER TABLE clients ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT
  '{"streakReminders":true,"events":true,"news":false}'::jsonb;

-- No-nulo = solicitud pendiente de revisión humana (visible en el panel
-- admin/clientes). Se limpia (vuelve a null) cuando el admin la marca
-- resuelta — sin enum de estados, alcanza con la presencia de la fecha.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;
