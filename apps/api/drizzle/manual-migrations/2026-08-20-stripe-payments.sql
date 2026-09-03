-- Pago digital con Stripe (pago único por periodo fijo, no suscripción).
-- This project has no automated DB migration system; run this SQL manually
-- against the dev and test Supabase databases via the SQL Editor (or the
-- disposable tsx script used during development).

-- Montos editables desde el panel admin nuevo ("Precios de Membresía") — NO
-- se usan Price objects de Stripe: PaymentIntent.create() recibe el amount
-- directo, los Price objects son para Checkout/Subscriptions.
CREATE TABLE IF NOT EXISTS membership_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_type text NOT NULL,
  duration_months integer NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  updated_at timestamptz DEFAULT now(),
  UNIQUE (client_type, duration_months)
);

INSERT INTO membership_prices (client_type, duration_months) VALUES
  ('coaching_1_1', 1), ('coaching_1_1', 3),
  ('coaching_online', 1), ('coaching_online', 3),
  ('mentoring', 3)
ON CONFLICT DO NOTHING;

-- Ledger de pagos + mecanismo de idempotencia: Stripe puede reenviar el
-- mismo evento de webhook más de una vez — la membresía solo se activa la
-- primera vez que esta fila pasa a 'succeeded'.
CREATE TABLE IF NOT EXISTS membership_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id),
  client_type text NOT NULL,
  duration_months integer NOT NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL,
  stripe_payment_intent_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  succeeded_at timestamptz
);

CREATE INDEX IF NOT EXISTS membership_payments_client_id_idx ON membership_payments(client_id);
