-- 20260731_observable_events_indice_peticiones_lentas.sql
--
-- Índice PARCIAL para el detector de «techo de timeout» (T-315 / T-361).
--
-- ── El problema, medido en producción el 31/07/2026 ──────────────────────────────────────────
-- `observable_events` está en 6,9 GB y ~10,5 M de filas. La consulta del detector filtra
-- `event_type='request_completed' AND duration_ms > 5000 AND created_at > now() - 14 días`, y
-- **sólo 1.081 filas cumplen ese filtro**. Sin índice que lo soporte, encontrarlas costaba
-- 117 s: escanear millones para quedarse con mil. Como el pool del backend corta a los 30 s
-- (`statement_timeout`), la consulta NUNCA terminaba → el detector se tragaba la excepción y no
-- emitía ni un hallazgo desde que nació.
--
-- ── Por qué este índice y no otro ────────────────────────────────────────────────────────────
-- El predicado es la parte SELECTIVA y es inmutable (`now()` no puede ir en un índice, y no hace
-- falta: la retención ya poda a 30 días, así que el índice se queda pequeño solo). Con ~1.000
-- filas ocupa kilobytes. `created_at` va de clave para el rango de días, y `endpoint`/`duration_ms`
-- viajan en el INCLUDE para que el agrupado por bandas se resuelva sin tocar el heap.
--
-- CONCURRENTLY: la tabla recibe escrituras constantes (es la de telemetría); construirlo sin
-- concurrencia la bloquearía. A cambio, esta migración NO puede ir dentro de una transacción.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_observable_events_peticiones_lentas
  ON public.observable_events (created_at DESC)
  INCLUDE (endpoint, duration_ms)
  WHERE event_type = 'request_completed' AND duration_ms > 5000;
