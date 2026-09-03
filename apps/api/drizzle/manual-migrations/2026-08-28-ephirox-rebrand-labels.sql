-- Rebranding Ephirox — actualiza los labels de módulo ya sembrados en
-- permission_modules (tabla consumida por RolesMatrixTable.tsx en el admin
-- de "Roles y Perfiles"). Estos labels viven como DATO, no como código, así
-- que el rename de nomenclatura del frontend no los toca — hace falta este
-- UPDATE explícito. Solo cambia texto visible; key/note/sort_order/allowed
-- no se tocan.

UPDATE permission_modules SET label = 'Baseline' WHERE key = 'personal_info';
UPDATE permission_modules SET label = 'Baseline (Breakthrough Sessions)' WHERE key = 'personal_info_mentoring';
UPDATE permission_modules SET label = 'Workout' WHERE key = 'training';
UPDATE permission_modules SET label = 'Nutrition' WHERE key = 'nutrition';
UPDATE permission_modules SET label = 'Stress' WHERE key = 'cortisol';
UPDATE permission_modules SET label = 'Sleep' WHERE key = 'rest';
UPDATE permission_modules SET label = 'Breakthrough Sessions' WHERE key = 'blindspot';
UPDATE permission_modules SET label = 'The Circle' WHERE key = 'community';
UPDATE permission_modules SET label = 'Evolution' WHERE key = 'evolution';
