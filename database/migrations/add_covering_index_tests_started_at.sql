-- =====================================================
-- MIGRACIÓN: Covering index en tests(started_at) INCLUDE (user_id)
--
-- PROBLEMA (incidente puntual 10/04/2026):
--   /api/v2/admin/charts devolvió 500 con "activity timeout after 15000ms"
--   en getActivityChartData. Bench en prod:
--     - warm cache: 40-70 ms
--     - primer hit frío: ~900 ms
--     - peor caso observado: >15 s en 1 ocurrencia (cold cache total +
--       contención + latencia red degradada)
--
--   La query es:
--     SELECT (started_at AT TIME ZONE 'Europe/Madrid')::date AS day,
--            COUNT(DISTINCT user_id) AS unique_users
--     FROM tests
--     WHERE started_at >= ? AND started_at < ? AND user_id IS NOT NULL
--     GROUP BY 1
--
--   El índice actual (idx_tests_started_at) solo tiene started_at en las
--   columnas del btree. Para COUNT(DISTINCT user_id) PG tiene que hacer
--   heap access por cada fila del índice para leer user_id. En mi EXPLAIN
--   eran 1718 páginas leídas del disco en frío (~860 ms de I/O).
--
-- SOLUCIÓN:
--   Crear un nuevo índice covering con user_id como INCLUDE. Con esto PG
--   puede resolver la query con un Index Only Scan, sin tocar el heap:
--
--     CREATE INDEX ... ON tests (started_at DESC) INCLUDE (user_id)
--       WHERE user_id IS NOT NULL
--
--   El predicado parcial WHERE user_id IS NOT NULL se mantiene igual que
--   el índice original — evita indexar tests anónimos.
--
-- PATRÓN DE APLICACIÓN:
--   CREATE INDEX CONCURRENTLY no toma ACCESS EXCLUSIVE LOCK. Permite
--   lecturas y escrituras concurrentes mientras se construye. Es lento
--   (escanea toda la tabla) pero no bloquea tráfico.
--
--   Tras crear el nuevo índice y verificar que PG lo usa, dropear el
--   viejo también CONCURRENTLY.
--
-- Métricas esperadas:
--   - Cold path: ~900 ms → ~100-200 ms (estimado)
--   - Warm path: sin cambio (ya era <70 ms)
--   - Tests afectados: solo consultas analíticas con GROUP BY started_at
--
-- Aplicada en producción: 2026-04-10
-- =====================================================

-- Fase 1: Crear el nuevo índice covering CONCURRENTLY
-- NOTA: CONCURRENTLY no puede ir dentro de una transacción — ejecutar
-- línea a línea si se aplica manualmente en psql. El script de aplicación
-- los ejecuta por separado.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_started_at_covering
  ON tests USING btree (started_at DESC)
  INCLUDE (user_id)
  WHERE user_id IS NOT NULL;

-- Fase 2: Dropear el índice viejo (también CONCURRENTLY, sin lock).
-- El nuevo covering es un superconjunto funcional — cualquier query que
-- use el viejo puede usar el nuevo.
DROP INDEX CONCURRENTLY IF EXISTS idx_tests_started_at;

-- ============================================
-- Verificación
-- ============================================
DO $$
DECLARE
  new_exists boolean;
  old_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'tests'
      AND indexname = 'idx_tests_started_at_covering'
  ) INTO new_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'tests'
      AND indexname = 'idx_tests_started_at'
  ) INTO old_exists;

  IF NOT new_exists THEN
    RAISE EXCEPTION '❌ El índice nuevo idx_tests_started_at_covering no existe';
  END IF;

  IF old_exists THEN
    RAISE WARNING '⚠️ El índice viejo idx_tests_started_at sigue existiendo — drop pendiente';
  END IF;

  RAISE NOTICE '✅ Covering index aplicado correctamente';
END $$;
