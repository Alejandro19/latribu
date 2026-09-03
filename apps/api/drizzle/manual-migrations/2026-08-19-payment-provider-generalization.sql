-- Generaliza membership_payments (hoy acoplada a Stripe) para soportar
-- múltiples proveedores de pago (Wompi ahora, Stripe cuando tenga llave real).
-- This project has no automated DB migration system; run this SQL manually
-- against the dev and test Supabase databases via the SQL Editor (or the
-- disposable tsx script used during development).

ALTER TABLE membership_payments ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe';
ALTER TABLE membership_payments RENAME COLUMN stripe_payment_intent_id TO provider_reference;
ALTER TABLE membership_payments DROP CONSTRAINT IF EXISTS membership_payments_stripe_payment_intent_id_key;
ALTER TABLE membership_payments ALTER COLUMN provider DROP DEFAULT;
ALTER TABLE membership_payments ADD CONSTRAINT membership_payments_provider_reference_unique UNIQUE (provider, provider_reference);
