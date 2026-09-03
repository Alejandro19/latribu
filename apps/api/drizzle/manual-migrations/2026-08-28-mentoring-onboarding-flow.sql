-- Flujo completo Mentoría: alta con invitación, onboarding obligatorio,
-- wearable auto-sync con baseline en dos etapas, laboratorios OCR+IA con
-- aprobación, y "Semana 1". Ver plan en tasks/plan.md de la sesión.

CREATE TABLE IF NOT EXISTS client_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_invitations_client_id_idx ON client_invitations(client_id);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS wearable_baseline_ready_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS wearable_baseline_stable_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS baseline_approved_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS wearable_approved_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS week1_activated_at timestamptz;

ALTER TABLE personal_info ADD COLUMN IF NOT EXISTS apple_health_connected boolean NOT NULL DEFAULT false;

ALTER TABLE lab_panels ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendiente';
ALTER TABLE lab_panels ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE lab_panels ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE lab_panels ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE lab_panels ADD COLUMN IF NOT EXISTS source_file_hash text;
