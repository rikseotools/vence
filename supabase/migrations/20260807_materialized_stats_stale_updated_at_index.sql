-- 20260807_materialized_stats_stale_updated_at_index.sql
--
-- La regla `materialized_stats_stale` moría con `canceling statement due to statement
-- timeout` en cada evaluación (T-475, regresión ya cerrada una vez en T-173 el 27/07 sin
-- confirmar que se curara con varios ticks). Es la GEMELA de T-173/cron_sin_exito
-- (20260801_cron_covering_incluye_severity.sql), mismo síntoma, tabla distinta.
--
-- ## La causa, medida y no supuesta
--
-- `EXPLAIN (ANALYZE, BUFFERS)` sobre la consulta real de la regla contra RDS
-- (VENCE_LECTOR_URL, 07/08/2026): NINGUNA de las 6 tablas que consulta tiene un índice que
-- cubra `updated_at` — confirmado con `pg_indexes` (cero resultados con `updated_at` en la
-- definición, en las seis). `MAX(updated_at)` fuerza un `Seq Scan` completo de cada una.
--
-- Las dos caras: `user_question_history_v2` (1.506.049 filas, 256 MB) → Seq Scan, 1.267.543
-- filas leídas, 1.620 ms, 32.710 buffers de disco; `user_article_stats` (742.867 filas,
-- 97 MB) → Seq Scan, 579.592 filas, 767 ms, 10.116 buffers de disco. Juntas ya son 2,4 s de
-- I/O de las 1,8 s totales medidas HOY (bajo caché parcial y sin más carga concurrente) — la
-- consulta de producción compite además con tráfico real, así que el margen hasta el
-- `statement_timeout` es más estrecho de lo que esta medición aislada sugiere. Las otras 4
-- tablas (10-40 k filas) son baratas hoy (<25 ms cada una) pero comparten el mismo defecto y
-- crecerán con el tiempo — se indexan las seis para cerrar el hueco entero, no solo el que
-- duele hoy.
--
-- ## El arreglo
--
-- Un índice simple sobre `updated_at` en cada tabla deja que el planificador resuelva
-- `MAX(updated_at)` con un `Index Scan Backward ... LIMIT 1` (O(log n)) en vez de un `Seq
-- Scan` completo (O(n)) — el mismo idioma que ya usa Postgres para MIN/MAX con índice.
--
-- `CONCURRENTLY`: estas tablas están en el camino de escritura de cada respuesta que se
-- guarda (el pipeline outbox→handlers que la propia regla vigila), así que un `CREATE INDEX`
-- bloqueante aquí sería exactamente el tipo de incidente que esta regla existe para avisar.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_question_history_v2_updated_at
  ON public.user_question_history_v2 USING btree (updated_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_article_stats_updated_at
  ON public.user_article_stats USING btree (updated_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_difficulty_stats_updated_at
  ON public.user_difficulty_stats USING btree (updated_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_daily_stats_updated_at
  ON public.user_daily_stats USING btree (updated_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_hourly_stats_updated_at
  ON public.user_hourly_stats USING btree (updated_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_stats_summary_updated_at
  ON public.user_stats_summary USING btree (updated_at);
