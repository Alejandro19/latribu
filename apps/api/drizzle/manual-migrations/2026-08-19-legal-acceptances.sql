-- Evidencia legal de aceptación (Política de Datos + Términos de Uso) y
-- borrador de registro SSO pendiente de esa aceptación. This project has no
-- automated DB migration system; run this SQL manually against the dev and
-- test Supabase databases via the SQL Editor.

-- Tabla de solo-inserción: ningún código debe hacer UPDATE ni DELETE sobre
-- ella. client_id NO tiene ON DELETE CASCADE a propósito — la evidencia no
-- debe desaparecer aunque el cliente se elimine.
CREATE TABLE IF NOT EXISTS legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id),
  data_policy_version text NOT NULL,
  terms_version text NOT NULL,
  sensitive_data_consent boolean NOT NULL,
  accepted_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_acceptances_client_id_idx ON legal_acceptances(client_id);

-- Token de un solo uso (10 min de vida), guardado solo como hash — mismo
-- patrón que password_reset_tokens.
CREATE TABLE IF NOT EXISTS sso_registration_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  provider text NOT NULL,
  provider_sub text NOT NULL,
  email text NOT NULL,
  name text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);
