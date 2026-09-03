-- Manual migration for "Roles y Perfiles" (admin module + type-level access matrix).
-- This project has no automated DB migration system; run this SQL manually against the
-- test/production Supabase database via the SQL Editor.
--
-- Seeds the matrix to reproduce EXACTLY today's real access behavior (nobody gains or
-- loses access the day this ships) — this deliberately does NOT match the literal example
-- in the original feature spec for lead_wellness (cortisol/rest are already open to
-- lead_wellness today via other mechanisms, so they're seeded true here too). Any real
-- policy change from here on happens through the new admin screen, not this seed.

CREATE TABLE IF NOT EXISTS permission_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_type_module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_type text NOT NULL,
  module_key text NOT NULL REFERENCES permission_modules(key) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT client_type_module_unique UNIQUE (client_type, module_key)
);

-- Labels actualizados al rebranding Ephirox (ver
-- 2026-08-28-ephirox-rebrand-labels.sql para el UPDATE aplicado a filas ya
-- sembradas en bases existentes) — nuevos entornos ya siembran con los
-- nombres correctos directamente.
INSERT INTO permission_modules (key, label, note, sort_order, is_custom) VALUES
  ('personal_info', 'Baseline', 'sin dispositivos y laboratorios', 0, false),
  ('personal_info_mentoring', 'Baseline (Breakthrough Sessions)', 'incluye módulo 10 · dispositivos y laboratorios', 1, false),
  ('training', 'Workout', NULL, 2, false),
  ('nutrition', 'Nutrition', NULL, 3, false),
  ('cortisol', 'Stress', NULL, 4, false),
  ('rest', 'Sleep', NULL, 5, false),
  ('blindspot', 'Breakthrough Sessions', NULL, 6, false),
  ('community', 'The Circle', NULL, 7, false),
  ('evolution', 'Evolution', NULL, 8, false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO client_type_module_permissions (client_type, module_key, allowed) VALUES
  ('coaching_1_1', 'personal_info', true),
  ('coaching_1_1', 'personal_info_mentoring', false),
  ('coaching_1_1', 'training', true),
  ('coaching_1_1', 'nutrition', true),
  ('coaching_1_1', 'cortisol', true),
  ('coaching_1_1', 'rest', true),
  ('coaching_1_1', 'blindspot', false),
  ('coaching_1_1', 'community', true),
  ('coaching_1_1', 'evolution', true),

  ('coaching_online', 'personal_info', true),
  ('coaching_online', 'personal_info_mentoring', false),
  ('coaching_online', 'training', true),
  ('coaching_online', 'nutrition', true),
  ('coaching_online', 'cortisol', true),
  ('coaching_online', 'rest', true),
  ('coaching_online', 'blindspot', false),
  ('coaching_online', 'community', true),
  ('coaching_online', 'evolution', true),

  ('lead_wellness', 'personal_info', false),
  ('lead_wellness', 'personal_info_mentoring', false),
  ('lead_wellness', 'training', false),
  ('lead_wellness', 'nutrition', false),
  ('lead_wellness', 'cortisol', true),
  ('lead_wellness', 'rest', true),
  ('lead_wellness', 'blindspot', false),
  ('lead_wellness', 'community', true),
  ('lead_wellness', 'evolution', true),

  ('mentoring', 'personal_info', false),
  ('mentoring', 'personal_info_mentoring', true),
  ('mentoring', 'training', true),
  ('mentoring', 'nutrition', true),
  ('mentoring', 'cortisol', true),
  ('mentoring', 'rest', true),
  ('mentoring', 'blindspot', true),
  ('mentoring', 'community', true),
  ('mentoring', 'evolution', true)
ON CONFLICT (client_type, module_key) DO NOTHING;
