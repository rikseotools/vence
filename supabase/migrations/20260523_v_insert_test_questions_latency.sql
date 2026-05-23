-- Migration: v_insert_test_questions_latency
-- 2026-05-23
--
-- Vista de solo-lectura que expone las latencias del INSERT a
-- test_questions desde pg_stat_statements. Sin tabla nueva, sin
-- acumulación — solo refleja lo que pg_stat_statements ya guarda
-- (es histórico desde el último reset).
--
-- ¿Por qué falta esta vista? El tab /admin/infraestructura → "Salud
-- sistema" necesita mostrar el coste actual del INSERT para detectar
-- si los triggers del fix de /api/stats lo degradan tras el cutover.
-- Hoy esa info solo se obtiene corriendo queries ad-hoc — no es
-- consumible desde una UI.
--
-- Caveat: pg_stat_statements puede ser reseteado (Supabase lo hace en
-- failovers / reboots). La vista muestra lo que haya en ese momento;
-- los números son agregados acumulativos, no de las últimas 24h.

CREATE OR REPLACE VIEW v_insert_test_questions_latency AS
SELECT
  -- Identificador de la variante (las distintas formas del INSERT
  -- según qué columnas se rellenan)
  LEFT(query, 120) AS query_snippet,
  calls,
  ROUND(total_exec_time::numeric, 1) AS total_ms,
  ROUND(mean_exec_time::numeric, 3) AS mean_ms,
  ROUND(stddev_exec_time::numeric, 3) AS stddev_ms,
  ROUND(min_exec_time::numeric, 3) AS min_ms,
  ROUND(max_exec_time::numeric, 3) AS max_ms,
  -- Proxy de p95: media + 2 stddev. NO es p95 real (pg_stat_statements
  -- no guarda histograma), pero da una pista decente cuando stddev es
  -- bajo. Si stddev es alto, la cola larga (queries que tardan mucho
  -- esporádicamente) la vemos por la diferencia entre mean y max.
  ROUND((mean_exec_time + 2 * stddev_exec_time)::numeric, 3) AS proxy_p95_ms,
  rows AS total_rows_affected
FROM pg_stat_statements
WHERE query ILIKE 'INSERT INTO%test_questions%'
   OR query ILIKE 'insert into "test_questions"%'
ORDER BY total_exec_time DESC;

COMMENT ON VIEW v_insert_test_questions_latency IS
  'Lectura directa de pg_stat_statements para INSERT a test_questions. Usada por /admin/infraestructura tab Salud Sistema. Reset implícito en failovers. Runbook: docs/runbooks/health-check.md.';

GRANT SELECT ON v_insert_test_questions_latency TO service_role;
REVOKE SELECT ON v_insert_test_questions_latency FROM anon;
REVOKE SELECT ON v_insert_test_questions_latency FROM PUBLIC;
