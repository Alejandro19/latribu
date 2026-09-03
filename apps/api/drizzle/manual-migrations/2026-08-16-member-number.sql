-- Manual migration for "Member card" / número de miembro autoasignado.
-- This project has no automated DB migration system; run this SQL manually against
-- the dev and test Supabase databases via the SQL Editor.

CREATE SEQUENCE IF NOT EXISTS member_number_seq START WITH 1 INCREMENT BY 1;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS member_number integer;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS activated_at timestamptz;

-- Backfill: clientes ya activos antes de este cambio, numerados por antigüedad (created_at).
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn
  FROM clients WHERE status = 'active' AND member_number IS NULL
)
UPDATE clients c SET member_number = ranked.rn, activated_at = COALESCE(c.activated_at, c.created_at)
FROM ranked WHERE c.id = ranked.id;

-- Reposiciona la secuencia después del máximo ya asignado por el backfill.
SELECT setval('member_number_seq', COALESCE((SELECT MAX(member_number) FROM clients), 0) + 1, false);

CREATE UNIQUE INDEX IF NOT EXISTS clients_member_number_key ON clients(member_number);
