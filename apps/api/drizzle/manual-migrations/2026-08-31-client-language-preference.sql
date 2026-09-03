-- Preferencia de idioma del cliente (Configuración > Idioma), primera
-- entrega del sistema ES/EN: solo cubre la interfaz fija (nav, botones,
-- textos del sistema) — el contenido administrable (frases, legal) sigue
-- en español por ahora. This project has no automated DB migration
-- system; run this SQL manually against the dev and test Supabase
-- databases via the SQL Editor (or the disposable tsx script used during
-- development).

ALTER TABLE clients ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'es';
