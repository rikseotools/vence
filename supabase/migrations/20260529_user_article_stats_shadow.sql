-- Tabla shadow para validar paridad bit-a-bit del handler outbox
-- antes de hacer cutover (DROP TRIGGER + RENAME TABLE).
--
-- Schema idéntico a `user_article_stats`. El worker outbox escribe aquí
-- (en SHADOW mode con env var `SHADOW_HANDLERS_ENABLED=true`). Tras 24h
-- de operación se ejecuta una query diff para comprobar que ambas tablas
-- tienen los mismos contadores por (user_id, article_id, article_number,
-- law_name, tema_number). Si paridad bit-a-bit → DROP TRIGGER
-- update_user_article_stats_insert/_update/_delete + RENAME TABLE shadow
-- → user_article_stats (sin downtime, swap atómico).
--
-- Roadmap: docs/roadmap/sprint-outbox-test-questions.md §1.3
-- Reversible: DROP TABLE user_article_stats_shadow;

BEGIN;

-- Crear shadow table con mismo schema que user_article_stats.
-- LIKE INCLUDING ALL replica columnas + indexes + constraints + defaults.
CREATE TABLE IF NOT EXISTS public.user_article_stats_shadow
  (LIKE public.user_article_stats INCLUDING ALL);

COMMENT ON TABLE public.user_article_stats_shadow IS
  'Shadow de user_article_stats para validación paridad worker outbox. '
  'Tras 24h soak con SHADOW_HANDLERS_ENABLED=true → query diff → swap. '
  'Ver docs/roadmap/sprint-outbox-test-questions.md §1.3';

-- Permisos service_role (worker)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_article_stats_shadow TO service_role;

-- NOTA: no copiamos datos existentes. La shadow table empieza vacía.
-- Cuando SHADOW_HANDLERS_ENABLED=true, el worker empieza a llenarla con
-- los nuevos eventos. La query diff posterior tiene que tener en cuenta
-- que solo cubre el rango temporal post-activación, no histórico.

COMMIT;

-- Query diff (ejecutar manualmente tras 24h de shadow):
-- SELECT
--   COUNT(*) FILTER (WHERE s.total_questions IS DISTINCT FROM r.total_questions) AS divergent_q,
--   COUNT(*) FILTER (WHERE s.correct_answers IS DISTINCT FROM r.correct_answers) AS divergent_c
-- FROM public.user_article_stats_shadow s
-- FULL OUTER JOIN public.user_article_stats r USING (user_id, article_id, article_number, law_name, tema_number)
-- WHERE COALESCE(s.updated_at, r.updated_at) > NOW() - INTERVAL '24 hours';
