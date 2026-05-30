-- Fase D-bis CQRS-light: optimización getUserAnswersWithArticles
-- Aplicada directo a prod 2026-05-30 via CREATE INDEX CONCURRENTLY
--
-- Problema:
--   - Heavy user (c16c186a, 64.720 test_questions): query original tarda 14.169ms
--   - Bottleneck #1: Bitmap Heap Scan en test_questions (4.5s heap fetches)
--   - Bottleneck #2: JOIN con questions hace 14.211 memoize misses (9s)
--
-- Solución:
--   1. Backfill tq.article_id para 3.158 filas legacy (consistencia)
--   2. Covering index en test_questions(user_id, question_id) INCLUDE(...)
--      → permite Index Only Scan eliminando heap fetches
--   3. Covering index en questions(id) INCLUDE(primary_article_id)
--      → permite Index Only Scan eliminando 14k lookups al heap de questions
--   4. Nuevo método getUserAnswersForArticles(userId, articleIds[])
--      → filtra en SQL en vez de cargar 64k + filtrar en JS
--   5. getTopicProgressForUser refactorizado para usar el flujo nuevo
--
-- Bench end-to-end (heavy user, tema 1):
--   - Antes: 14.169ms cold / 320ms warm
--   - Después: 1.500ms cold / 180ms warm  (10× cold / 1.7× warm speedup)
--
-- Paridad EXACTA verificada: total=2669, correct=2434, unique_q=571 idénticos.

-- ────────────────────────────────────────────────────────────────
-- 1) Backfill tq.article_id legacy (3.158 filas)
-- ────────────────────────────────────────────────────────────────
-- Aplicado 2026-05-30 vía script Node. Sin lock, atómico.
-- UPDATE test_questions tq
-- SET article_id = q.primary_article_id
-- FROM questions q
-- WHERE tq.question_id = q.id
--   AND tq.article_id IS NULL
--   AND q.primary_article_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────
-- 2) Covering index test_questions: permite Index Only Scan
-- ────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tq_user_q_full_covering
ON public.test_questions (user_id, question_id)
INCLUDE (is_correct, created_at, time_spent_seconds, difficulty,
         confidence_level, law_name, article_id)
WHERE user_id IS NOT NULL;

-- Tamaño: ~150MB (1.29M filas). Justified por eliminar 4.5s heap fetches.

-- ────────────────────────────────────────────────────────────────
-- 3) Covering index questions: elimina lookups al heap en JOIN
-- ────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_id_with_article
ON public.questions (id) INCLUDE (primary_article_id)
WHERE primary_article_id IS NOT NULL;

-- Tamaño: ~5MB (104k filas). Justified por eliminar 14k random reads.

-- ────────────────────────────────────────────────────────────────
-- 4) VACUUM ANALYZE para activar Index Only Scan
-- ────────────────────────────────────────────────────────────────
-- VACUUM (ANALYZE) public.test_questions;
-- VACUUM (ANALYZE) public.questions;
-- (Aplicado vía script Node tras crear índices)
