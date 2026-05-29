-- Tabla shadow para handler outbox user_daily_stats.
-- Ver docs/roadmap/sprint-outbox-test-questions.md §1.4

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_daily_stats_shadow
  (LIKE public.user_daily_stats INCLUDING ALL);

COMMENT ON TABLE public.user_daily_stats_shadow IS
  'Shadow de user_daily_stats para validación paridad worker outbox.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_daily_stats_shadow TO service_role;

COMMIT;
