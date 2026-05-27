-- Migration: 2026-05-27 — Índice cubriente del filtro real del endpoint
-- /api/v2/topic-progress/weak-articles.
--
-- Contexto:
--   El endpoint hace WHERE user_id = X AND success_rate < 0.6 AND total_attempts >= N
--   sobre user_question_history (783k filas). Los índices existentes son single-column
--   (user_id, success_rate, question_id) — Postgres puede usar uno y filtrar el resto
--   con bitmap heap scan, costoso para users heavy.
--
--   El índice partial+compuesto cubre el WHERE exacto y reduce el plan a Index Only Scan
--   sobre las ~78k filas que cumplen success_rate < 0.6.
--
-- Métricas baseline (pre-índice, 7d previos):
--   - 50 status 5xx (timeouts a 15s)
--   - p99 latencia 200: 15007ms
--   - p95: 650ms
--   - p50: 31ms (irrelevante, ya rápido en caso simple)
--
-- CONCURRENTLY:
--   - SHARE UPDATE EXCLUSIVE lock — NO bloquea reads ni writes en uqh.
--   - Construcción más lenta pero production-safe sin ventana.
--   - NO funciona en transaction mode pgbouncer (Supavisor port 6543).
--     Ejecutar contra conexión session-mode: DATABASE_URL directo al port 5432
--     o self-hosted pooler en session mode.
--
-- Rollback:
--   DROP INDEX CONCURRENTLY idx_uqh_user_weak;
--
-- Documentación completa: docs/roadmap/weak-articles-perf.md

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_uqh_user_weak
ON user_question_history (user_id, total_attempts)
WHERE success_rate < 0.6;

-- Verificación post-creación (manual):
--   SELECT indexname, indexdef, indisvalid
--   FROM pg_indexes pi
--   JOIN pg_class pc ON pc.relname = pi.indexname
--   JOIN pg_index pix ON pix.indexrelid = pc.oid
--   WHERE indexname = 'idx_uqh_user_weak';
--   -- Si indisvalid = false → INVALID, repetir CREATE.
