-- Shadow tables para los 7 handlers restantes del worker outbox (Fase 1.4).
-- Ver docs/roadmap/sprint-outbox-test-questions.md §1.4
--
-- LIKE INCLUDING ALL replica schema + indexes + constraints + defaults exactos.
-- Permisos service_role para el worker NestJS.

BEGIN;

-- 3. user_hourly_stats
CREATE TABLE IF NOT EXISTS public.user_hourly_stats_shadow
  (LIKE public.user_hourly_stats INCLUDING ALL);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_hourly_stats_shadow TO service_role;

-- 4. user_difficulty_stats
CREATE TABLE IF NOT EXISTS public.user_difficulty_stats_shadow
  (LIKE public.user_difficulty_stats INCLUDING ALL);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_difficulty_stats_shadow TO service_role;

-- 5. user_stats_summary (compartida por handlers #5 y #6)
CREATE TABLE IF NOT EXISTS public.user_stats_summary_shadow
  (LIKE public.user_stats_summary INCLUDING ALL);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_stats_summary_shadow TO service_role;

-- 7. user_question_history_v2
CREATE TABLE IF NOT EXISTS public.user_question_history_v2_shadow
  (LIKE public.user_question_history_v2 INCLUDING ALL);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_question_history_v2_shadow TO service_role;

-- 8. law_question_first_attempts
CREATE TABLE IF NOT EXISTS public.law_question_first_attempts_shadow
  (LIKE public.law_question_first_attempts INCLUDING ALL);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.law_question_first_attempts_shadow TO service_role;

-- 9. question_first_attempts
CREATE TABLE IF NOT EXISTS public.question_first_attempts_shadow
  (LIKE public.question_first_attempts INCLUDING ALL);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_first_attempts_shadow TO service_role;

COMMIT;
