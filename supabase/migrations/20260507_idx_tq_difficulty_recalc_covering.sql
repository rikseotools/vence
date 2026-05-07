-- Migration: idx_tq_difficulty_recalc_covering (Sprint hardening 2026-05-07)
--
-- PROBLEMA: cron recalc-question-difficulty falla por statement_timeout (8s)
-- bajo carga en horas pico (~0.6% de runs en 7d, clusterizados 11-21 UTC).
--
-- DIAGNÓSTICO (EXPLAIN ANALYZE 2026-05-07):
--   Aggregation cold cache: 2,690ms (4,171 buffers READ from disk)
--   Aggregation warm cache:    78ms
--   El plan usa idx_test_questions_question_user (question_id, test_id),
--   pero las columnas necesarias para los AVG (is_correct, time_spent_seconds,
--   confidence_level) requieren heap lookup → cold-cache se va a disco.
--   Cuando coincide cache frío + UPDATE concurrente desde trigger
--   update_question_difficulty_immediate → 8s timeout.
--
-- FIX: índice covering específico para el aggregation pattern del recalc.
-- Permite Index-Only Scan, elimina los heap reads.
--
-- COSTE:
--   - ~50MB extra en disco (test_questions ya tiene 468MB de índices)
--   - +0.3-0.5ms por INSERT (test_questions ya tiene 14 índices, este es el 15º)
--   - 0ms en UPDATEs: las columnas INCLUDE son inmutables tras el INSERT
--     inicial (is_correct, time_spent_seconds, confidence_level no cambian),
--     así que el índice no paga write amplification por updates.
--
-- ESCALABILIDAD: a 10k DAU (5.8 inserts/seg) la latencia añadida es
-- despreciable. A 100k DAU+ se justificaría una tabla question_stats
-- incremental, pero este índice no sería barrera para esa migración.
--
-- CONCURRENTLY: zero-downtime, no bloquea writes durante la creación.
--
-- Idempotente.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tq_difficulty_recalc_covering
  ON public.test_questions (question_id)
  INCLUDE (is_correct, time_spent_seconds, confidence_level)
  WHERE question_id IS NOT NULL;

-- Predicado parcial: las filas con question_id IS NULL son tests
-- psicotécnicos (~3% del total según el índice idx_test_questions_psychometric_id),
-- nunca aparecen en el agg del recalc. Excluirlas reduce tamaño del índice.

COMMENT ON INDEX public.idx_tq_difficulty_recalc_covering IS
  'Covering index para recalculate_dirty_question_difficulty CTE agg. INCLUDE permite Index-Only Scan, elimina cold-cache heap reads que causaban statement_timeout (commit 2026-05-07).';
