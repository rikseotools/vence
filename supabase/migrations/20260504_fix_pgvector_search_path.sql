-- Migration: fix pgvector search_path en funciones públicas
-- 2026-05-04
--
-- BUG: 4 funciones públicas que usan el operador `<=>` (cosine distance de
-- pgvector) tienen `SET search_path TO 'public', 'pg_temp'` hardcoded.
-- pgvector está instalado en schema `extensions` (práctica recomendada de
-- Supabase post-migración), por lo que el operador `<=>` no se encuentra
-- al ejecutar las funciones.
--
-- SÍNTOMA: error en /api/ai/chat-v2 al menos 7 veces en 12h del 4 may 2026:
--   { code: '42883', message: 'operator does not exist:
--     extensions.vector <=> extensions.vector' }
--
-- El endpoint devuelve 200 (try/catch en código TS) pero la búsqueda
-- semántica del AI chat falla silenciosamente — calidad del chat
-- degradada sin que el usuario lo perciba.
--
-- FIX: añadir 'extensions' al search_path de las 4 funciones afectadas.
--
-- Verificación pre-migración (BEGIN; ALTER; SELECT; ROLLBACK):
--   - Sin fix: error 42883 inmediato
--   - Con fix: devuelve resultados correctamente
--
-- Funciones afectadas (todas en schema public):
--   1. hybrid_search_articles — usado por chat-v2 (búsqueda semántica + fulltext)
--   2. match_articles — búsqueda semántica simple
--   3. match_help_articles — búsqueda en artículos de ayuda
--   4. match_knowledge_base — búsqueda en knowledge base interna
--
-- También se aplica a 2 funciones que reciben/manipulan vector pero no usan
-- `<=>` (preventivo, mismo problema potencial si en el futuro se usa el operador):
--   - mark_article_embedding_stale
--   - update_article_embedding
--
-- Idempotente: ALTER FUNCTION ... SET search_path se puede aplicar N veces.

ALTER FUNCTION public.hybrid_search_articles(vector, text, integer, double precision, double precision, uuid[])
  SET search_path TO 'public', 'extensions', 'pg_temp';

ALTER FUNCTION public.match_articles(vector, double precision, integer)
  SET search_path TO 'public', 'extensions', 'pg_temp';

ALTER FUNCTION public.match_help_articles(vector, double precision, integer)
  SET search_path TO 'public', 'extensions', 'pg_temp';

ALTER FUNCTION public.match_knowledge_base(vector, double precision, integer, text)
  SET search_path TO 'public', 'extensions', 'pg_temp';

-- Preventivo: funciones que manejan vector sin usar <=> aún
ALTER FUNCTION public.mark_article_embedding_stale()
  SET search_path TO 'public', 'extensions', 'pg_temp';

ALTER FUNCTION public.update_article_embedding(uuid, text)
  SET search_path TO 'public', 'extensions', 'pg_temp';

-- Verificación post-aplicación (no ejecutable en migración, solo doc):
--   SELECT proname, proconfig FROM pg_proc
--     WHERE pronamespace = 'public'::regnamespace
--       AND prosrc ILIKE '%<=>%';
--   → Esperado: las 4 funciones con search_path=public, extensions, pg_temp
