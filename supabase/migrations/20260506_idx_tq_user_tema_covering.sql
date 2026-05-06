-- 2026-05-06 — Covering index para acelerar /api/v2/topic-progress/theme-stats
--
-- PROBLEMA medido en producción:
-- - User c16c186a... (56k test_questions): query de theme-stats tarda 12.5s
-- - Endpoint timeout a los 10s → graceful degradation devuelve stale/empty
-- - 4 timeouts en 30 min observados en logs Vercel para este user
-- - Top 10 heavy users (>10k test_questions cada uno) afectados igual
--
-- DIAGNÓSTICO (EXPLAIN ANALYZE pre-fix):
--   Nested Loop con Index Scan idx_test_questions_test_id por cada test
--   → 1711 tests × 33 rows/test = 56k random heap reads (35909 page reads)
--   → I/O dominated, 12.5s execution
--
-- ROOT CAUSE:
-- 1. Query hacía JOIN test_questions × tests por test_id, cuando user_id
--    ya estaba denormalizado en test_questions desde commit anterior
-- 2. Aún reescribiendo sin JOIN, idx_tq_user_id no cubre las columnas
--    agregadas (is_correct, created_at) → Bitmap Heap Scan masivo (11.2s)
-- 3. Faltaba covering index con INCLUDE de los campos agregados
--
-- SOLUCIÓN: covering index con los campos del GROUP BY + agregaciones
--   - Index Only Scan, 0 random heap reads
--   - Filtro WHERE user_id IS NOT NULL + tema_number IS NOT NULL reduce
--     tamaño del índice (no indexa rows huérfanos pre-denormalización)
--
-- IMPACTO MEDIDO post-fix con este índice (en producción 2026-05-06):
--   12.5s → 502ms (24.9x speedup) para user heavy de 56k rows
--   Buffers: 35909 page reads → 649 page reads
--
-- COSTE storage: ~25MB para 773k rows con 4 columnas. Aceptable.
-- COSTE write: 1 índice extra a mantener en cada INSERT a test_questions.
--   Negligible (la tabla acepta ~14k inserts/día → ~10MB/día write extra).

-- IMPORTANTE: CREATE INDEX CONCURRENTLY no puede ejecutarse en transacción.
-- Si esta migración corre dentro de una transacción Supabase, fallará. En ese
-- caso, ejecutar la sentencia manualmente vía psql / Supabase SQL editor.
-- En producción ya se aplicó así (2026-05-06).

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tq_user_tema_covering
  ON public.test_questions (user_id, tema_number)
  INCLUDE (is_correct, created_at)
  WHERE user_id IS NOT NULL AND tema_number IS NOT NULL;

-- Verificación post-deploy:
--   EXPLAIN (ANALYZE, BUFFERS) SELECT tema_number, COUNT(*)
--     FROM test_questions WHERE user_id = '<heavy-user>' AND tema_number IS NOT NULL
--     GROUP BY tema_number;
--   → Plan debe usar "Index Only Scan using idx_tq_user_tema_covering"
--   → "Heap Fetches" bajo (<5% de rows escaneados)
