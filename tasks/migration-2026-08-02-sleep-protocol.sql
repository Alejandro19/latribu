-- Migración manual para Descanso — Protocolo de Sueño Personalizado
-- (sleep_protocols, sleep_logs). Correr en el Supabase SQL Editor de
-- producción. Idempotente (seguro re-correr).

CREATE TABLE IF NOT EXISTS sleep_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  protocol_text TEXT,
  sleep_window TEXT,
  supplement TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sleep_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  hours NUMERIC(3,1) NOT NULL,
  quality INT NOT NULL CHECK (quality BETWEEN 1 AND 5),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, date)
);
