-- ===========================================
-- ÍNDICES PARA TEMA-RESOLVER (100k+ usuarios)
-- ===========================================
-- Ejecutar este script en Supabase para optimizar
-- las queries de resolución de tema
--
-- Autor: Claude
-- Fecha: 2026-01-16
-- ===========================================

-- 1. Índice en questions.primary_article_id (JOIN frecuente)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_primary_article_id
ON questions(primary_article_id)
WHERE primary_article_id IS NOT NULL;

-- 2. Índice en articles para búsqueda por law_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_law_id
ON articles(law_id);

-- 3. Índice en topic_scope para la búsqueda principal
-- Este es el índice más importante para el JOIN
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topic_scope_law_id_topic_id
ON topic_scope(law_id, topic_id);

-- 4. Índice GIN para article_numbers (array contains)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topic_scope_article_numbers_gin
ON topic_scope USING GIN(article_numbers);

-- 5. Índice compuesto en topics para filtro por position_type + is_active
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topics_position_type_active
ON topics(position_type, is_active)
WHERE is_active = true;

-- 6. Índice en user_profiles.target_oposicion para getUserOposicion
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_target_oposicion
ON user_profiles(target_oposicion)
WHERE target_oposicion IS NOT NULL;

-- ===========================================
-- VERIFICAR ÍNDICES CREADOS
-- ===========================================

-- Verificar que los índices existen
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('questions', 'articles', 'topic_scope', 'topics', 'user_profiles')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ===========================================
-- ESTADÍSTICAS DE TABLAS (actualizar después de crear índices)
-- ===========================================

ANALYZE questions;
ANALYZE articles;
ANALYZE topic_scope;
ANALYZE topics;
ANALYZE user_profiles;
