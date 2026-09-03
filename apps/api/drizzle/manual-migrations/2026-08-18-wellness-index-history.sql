-- Historial semanal del Índice de bienestar (home + Mi Evolución). This
-- project has no automated DB migration system; run this SQL manually
-- against the dev and test Supabase databases via the SQL Editor.

CREATE TABLE IF NOT EXISTS wellness_index_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  value integer NOT NULL,
  components_used jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE (client_id, period_start)
);

CREATE INDEX IF NOT EXISTS wellness_index_history_client_id_idx ON wellness_index_history(client_id);
