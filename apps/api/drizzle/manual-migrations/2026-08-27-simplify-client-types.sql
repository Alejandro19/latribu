-- Simplifica el modelo de cliente: se retiran los tipos coaching_online
-- (Club Online) y lead_wellness (Club Explorador/Leads). Quedan activos
-- únicamente coaching_1_1 (Cliente 1:1) y mentoring (Mentoría), alineado con
-- el pivote a un modelo B2B2C de cohortes ejecutivas.
--
-- No hay ningún cliente real con estos tipos al momento de esta migración
-- (verificado en producción: 2 coaching_1_1, 3 mentoring, 0 de los otros
-- dos), así que esto es limpieza de filas de configuración, no una
-- migración de datos de clientes reales.

-- 1) Default de la columna: antes 'lead_wellness' (tipo gratuito de alta
--    automática, ya retirado), ahora 'coaching_1_1' — el tipo base que
--    recibe cualquier cliente creado manualmente desde el panel admin antes
--    de que se le asigne un tipo explícito.
ALTER TABLE clients ALTER COLUMN client_type SET DEFAULT 'coaching_1_1';

-- 2) Matriz de permisos por tipo — ya no aplica a tipos que no existen.
DELETE FROM client_type_module_permissions WHERE client_type IN ('coaching_online', 'lead_wellness');

-- 3) Precios de membresía — coaching_online ya no es un tier pagable.
DELETE FROM membership_prices WHERE client_type = 'coaching_online';

-- Nota deliberada: `membership_payments` y `sso_registration_drafts` (esta
-- última eliminada de schema.ts junto con el flujo que la usaba) guardan
-- historial/auditoría — no se tocan filas históricas con estos valores.
DROP TABLE IF EXISTS sso_registration_drafts;
