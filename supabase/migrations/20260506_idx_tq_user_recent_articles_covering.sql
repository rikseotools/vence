-- 2026-05-06 — Covering index para acelerar /api/notifications/problematic-articles
--
-- PROBLEMA medido en producción:
-- - 16 errores 503 críticos en /api/notifications/problematic-articles entre
--   15:23 y 16:19 UTC del 2026-05-06 (ventana de ~56 min)
-- - Distribuidos (~1 cada 3.5 min) → blip del pooler eu-west-2 puntual,
--   no caso patológico de query
-- - El withDbTimeout(10s) de Phase 3 disparaba correctamente cuando bajo
--   congestión la query (normalmente 200-800ms) acumulaba tiempo
--
-- DIAGNÓSTICO (EXPLAIN ANALYZE pre-fix, user b8342672 con 2557 test_questions
-- últimos 7 días, 789 artículos):
--   - Bitmap Heap Scan on test_questions: 4572 heap blocks (1425 disk reads)
--   - 116ms warm, 800ms cuando BD bajo carga
--
-- ROOT CAUSE:
-- Query usa idx_tq_user_id + idx_test_questions_created_at via BitmapAnd,
-- pero las columnas agregadas (article_id, is_correct) no están en ningún
-- índice → Bitmap Heap Scan masivo por cada query.
--
-- SOLUCIÓN: covering index con (user_id, created_at) + INCLUDE de los
-- campos consumidos por GROUP BY/aggregations/JOIN:
--   - article_id: usado en GROUP BY + JOIN articles
--   - is_correct: usado en SUM CASE WHEN aggregation
--   - test_id: usado en JOIN tests para filtro is_completed
--
-- WHERE filter (user_id IS NOT NULL AND article_id IS NOT NULL) reduce
-- tamaño del índice excluyendo rows huérfanos pre-denormalización.
--
-- IMPACTO MEDIDO post-fix con este índice (4 users heavy, 2557-5651 rows):
--   - Warm execution: 200-800ms → 44-57ms (4-19x speedup)
--   - User b8342672 (peor caso pre-fix): 830ms → 44ms (18.9x)
--   - Plan: Index Only Scan, 0 disk reads (vs 1425 antes)
--
-- COSTE storage: ~30MB para 773k rows con 4 columnas. Aceptable.
-- COSTE write: 1 índice extra a mantener en cada INSERT/UPDATE en
-- test_questions. Negligible (~14k inserts/día → <15MB/día write extra).
--
-- COMPLEMENTA al covering index de theme-stats (idx_tq_user_tema_covering,
-- migración 20260506) — ese cubre user_id+tema_number, este cubre
-- user_id+created_at. Diferentes patrones de query, índices distintos.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tq_user_recent_articles_covering
  ON public.test_questions (user_id, created_at)
  INCLUDE (article_id, is_correct, test_id)
  WHERE user_id IS NOT NULL AND article_id IS NOT NULL;

-- Verificación post-deploy:
--   EXPLAIN (ANALYZE, BUFFERS) SELECT tq.article_id, COUNT(*) ...
--     FROM test_questions tq JOIN tests t ON tq.test_id = t.id
--     JOIN articles a ON tq.article_id = a.id JOIN laws l ON a.law_id = l.id
--     WHERE tq.user_id = '<heavy-user>' AND t.is_completed = true
--       AND tq.created_at >= CURRENT_DATE - interval '7 days'
--       AND l.id = ANY(<scope-laws>) ...;
--   → Plan debe usar "Index Only Scan using idx_tq_user_recent_articles_covering"
--   → Buffers principalmente "shared hit", read=0 cuando warm
