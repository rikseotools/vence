-- 20260801_cron_covering_incluye_severity.sql
--
-- La regla que vigila los crons no podía ejecutarse. [salud · alert_rule_failing]
--
-- ## Qué estaba pasando
--
-- `cron_sin_exito` —la regla que avisa de «un cron corriendo y FALLANDO»— moría con
-- `canceling statement due to statement timeout` en cada evaluación: 41 fallos en 6 h el
-- 01/08/2026, y subiendo. O sea que **la vigilancia de los crons llevaba horas sin funcionar**,
-- y eso no se ve como un rojo: se ve como silencio.
--
-- ## La causa, medida y no supuesta
--
-- `EXPLAIN (ANALYZE, BUFFERS)` sobre la consulta de la regla: **Parallel Seq Scan** sobre
-- `observable_events` entera (6,9 GB, 10,7 M filas en 30 días), 386.081 bloques leídos de disco,
-- 48 s de I/O y **29.157 ms de ejecución** para devolver 54 filas.
--
-- No era falta de `ANALYZE` (el autoanalyze había corrido ese mismo día a las 16:29, con solo
-- 20 k modificaciones pendientes) — se comprobó antes de tocar nada, porque el runbook advierte
-- de ese gotcha y era la hipótesis obvia.
--
-- Era el índice: `idx_observable_events_cron_covering` cubría `(event_type, ts DESC)` e incluía
-- `endpoint` y `duration_ms`, **pero no `severity`** — que es justo la columna sobre la que la
-- regla agrega (`FILTER (WHERE severity IN ('error','critical'))`). Sin ella no cabe un
-- *index-only scan*, así que había que ir al montón por cada fila y el planificador prefirió
-- barrer la tabla.
--
-- ## El arreglo y su medida
--
-- Añadir `severity` al INCLUDE. Es un índice PARCIAL (solo `cron_tick`/`cron_run`), así que
-- ocupa **50 MB**, no el tamaño de la tabla.
--
--   antes:  Parallel Seq Scan · 386.081 bloques de disco · 29.157 ms
--   ahora:  Parallel Index Only Scan · 0 lecturas de disco ·  1.365 ms   (21× más rápido)
--
-- El índice viejo se retira porque queda REDUNDANTE por construcción: misma clave, mismo WHERE,
-- y su INCLUDE es un subconjunto del nuevo. Mantener los dos solo encarecería cada escritura de
-- una tabla que recibe millones de filas al mes.
--
-- Ambas operaciones van CONCURRENTLY: `observable_events` está en el camino de escritura de casi
-- todo, y un bloqueo aquí se nota en la aplicación entera.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_observable_events_cron_covering_v2
  ON public.observable_events USING btree (event_type, ts DESC)
  INCLUDE (endpoint, duration_ms, severity)
  WHERE (event_type = ANY (ARRAY['cron_tick'::text, 'cron_run'::text]));

DROP INDEX CONCURRENTLY IF EXISTS idx_observable_events_cron_covering;
