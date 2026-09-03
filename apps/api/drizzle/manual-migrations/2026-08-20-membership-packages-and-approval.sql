-- Membresías v2: paquetes de clases (Presencial), saldo de sesiones,
-- aprobación diferenciada de pagos, y auditoría del puente TRM (Elite).
-- This project has no automated DB migration system; run this SQL manually
-- against the dev and test Supabase databases via the SQL Editor (or the
-- disposable tsx script used during development).

-- Presencial: paquete de clases como tercera dimensión de precio.
ALTER TABLE membership_prices ADD COLUMN IF NOT EXISTS package_size integer;
ALTER TABLE membership_prices DROP CONSTRAINT IF EXISTS membership_prices_client_type_duration_months_key;
ALTER TABLE membership_prices ADD CONSTRAINT membership_prices_client_type_duration_package_unique UNIQUE (client_type, duration_months, package_size);

-- Las 2 filas viejas de coaching_1_1 (sin paquete) ya no aplican — Presencial
-- siempre se compra como paquete de clases, nunca solo "por plazo".
DELETE FROM membership_prices WHERE client_type = 'coaching_1_1';
INSERT INTO membership_prices (client_type, duration_months, package_size, amount_cents, currency) VALUES
  ('coaching_1_1', 1, 8,  78000000,  'cop'),
  ('coaching_1_1', 3, 8,  225000000, 'cop'),
  ('coaching_1_1', 1, 12, 87000000,  'cop'),
  ('coaching_1_1', 3, 12, 251000000, 'cop'),
  ('coaching_1_1', 1, 16, 96000000,  'cop'),
  ('coaching_1_1', 3, 16, 277000000, 'cop');

UPDATE membership_prices SET amount_cents = 45000000,  currency = 'cop' WHERE client_type = 'coaching_online' AND duration_months = 1;
UPDATE membership_prices SET amount_cents = 129000000, currency = 'cop' WHERE client_type = 'coaching_online' AND duration_months = 3;
-- mentoring queda igual: 400000/'usd' — es el monto de REFERENCIA; el puente
-- TRM lo convierte a COP en tiempo de checkout, no acá.

-- Saldo de clases vigente, vive en clients igual que plan_end_date.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sessions_total integer;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sessions_remaining integer;

-- membership_payments: snapshot de lo comprado + aprobación diferenciada +
-- auditoría del puente TRM.
ALTER TABLE membership_payments ADD COLUMN IF NOT EXISTS package_size integer;
ALTER TABLE membership_payments ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false;
ALTER TABLE membership_payments ADD COLUMN IF NOT EXISTS applied_at timestamptz;
ALTER TABLE membership_payments ADD COLUMN IF NOT EXISTS trm_used numeric;
ALTER TABLE membership_payments ADD COLUMN IF NOT EXISTS trm_date date;
ALTER TABLE membership_payments ADD COLUMN IF NOT EXISTS margin_applied numeric;
