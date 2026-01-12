-- Migración: Índice para optimizar query de estadísticas por tema
-- Problema: La query en /api/user/theme-stats está causando timeouts
-- Fecha: 2026-01-12

-- Este índice optimiza la query:
-- SELECT tema_number, COUNT(*), SUM(is_correct), MAX(created_at)
-- FROM test_questions JOIN tests ON test_questions.test_id = tests.id
-- WHERE tests.user_id = ? AND tema_number IS NOT NULL
-- GROUP BY tema_number

-- Índice parcial en test_questions para la agregación por tema
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_questions_tema_stats
ON test_questions (test_id, tema_number, is_correct, created_at)
WHERE tema_number IS NOT NULL;

-- Índice en tests para el filtro por user_id (si no existe)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_user_id
ON tests (user_id);

-- Verificar que los índices se crearon
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('test_questions', 'tests') ORDER BY tablename, indexname;
