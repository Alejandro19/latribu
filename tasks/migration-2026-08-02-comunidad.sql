-- Migración manual para Comunidad (community_events, event_reservations,
-- community_therapies, therapy_reservations). Correr en el Supabase SQL
-- Editor de producción. Idempotente (seguro re-correr).

CREATE TABLE IF NOT EXISTS community_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ,
  location TEXT,
  capacity INT,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada','cancelada')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, client_id)
);

CREATE TABLE IF NOT EXISTS community_therapies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  discount_pct INT DEFAULT 0,
  provider TEXT,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS therapy_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapy_id UUID NOT NULL REFERENCES community_therapies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada','cancelada')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(therapy_id, client_id)
);