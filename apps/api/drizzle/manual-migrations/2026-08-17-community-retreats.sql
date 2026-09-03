-- Manual migration for "Retiros" dentro de Club Wellness (mismo sistema de
-- reservas que Eventos/Terapias). This project has no automated DB migration
-- system; run this SQL manually against the dev and test Supabase databases
-- via the SQL Editor.

CREATE TABLE IF NOT EXISTS community_retreats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  start_date timestamptz,
  end_date timestamptz,
  location text,
  capacity integer,
  price_cents integer,
  image_url text,
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS retreat_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES community_retreats(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'confirmada',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS retreat_reservations_client_id_idx ON retreat_reservations(client_id);
