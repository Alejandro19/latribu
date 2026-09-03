-- Tiempo despierto real reportado por el wearable (Oura: `awake_time`) — antes
-- se derivaba como total - (profundo+rem+ligero), que casi siempre da 0
-- porque total_sleep_duration de Oura ya excluye el tiempo despierto por
-- definición. Ver bug reportado en Sleep: "Despierto" siempre mostraba 0:00.
ALTER TABLE wearable_metricas
  ADD COLUMN sueno_despierto_minutos integer;
