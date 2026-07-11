-- 20260711_observable_events_created_at_idx.sql
-- Índice en observable_events(created_at) para el cron `telemetry-retention`.
--
-- observable_events (5 GB / ~9,4 M filas) NO tenía índice en created_at (solo en
-- ts). La poda de retención filtra por `created_at` (hora de INSERCIÓN, fiable — a
-- diferencia de `ts`, que puede venir corrupta del cliente: visto un ts=2067). Sin
-- este índice, cada ejecución nocturna del cron haría un seq scan de 5 GB para
-- encontrar las filas > 30 días.
--
-- CONCURRENTLY: no bloquea escrituras (la tabla recibe request_completed en caliente).
-- Aplicado en vivo a RDS el 11/07/2026; este fichero es el registro/repro.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_observable_events_created_at
  ON public.observable_events (created_at);
