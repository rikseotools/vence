-- Apagar el cron recalc-question-difficulty (Fase 2-bis cierre completo).
--
-- CONTEXTO: el cron mantenía `questions.difficulty` (text) recalculándolo
-- desde test_questions completo (todas las respuestas de todos los usuarios,
-- sin distinguir primer intento de retest). El cálculo está sesgado: las
-- repeticiones de los mismos usuarios bajan artificialmente la dificultad
-- (al repasar acertan más). Concretamente, una pregunta hard cuyo primer
-- intento falla el 80% pero recibe 90 retests con 95% acierto, el cron la
-- clasifica como "easy" (87% promedio) — pierdes la información real de
-- que es difícil.
--
-- La categoría real ya se mantiene en `global_difficulty_category` con
-- primer intento de cada usuario (sin sesgo). El campo `difficulty` queda
-- como FALLBACK ESTÁTICO con la categoría inicial de importación
-- (típicamente 'medium').
--
-- Esta migración:
--   1. Modifica update_question_difficulty_immediate para que sea NO-OP
--      (deja de marcar stats_dirty=true en cada INSERT a test_questions).
--   2. DROPs la función recalculate_dirty_question_difficulty (ya nadie
--      la llama: el endpoint /api/cron/recalc-question-difficulty se
--      elimina en el mismo PR junto con el workflow GHA y la entrada
--      vercel.json).
--
-- NO se elimina la columna `questions.stats_dirty` ni `questions.difficulty`
-- — quedan para PRs aparte tras periodo de margen.

BEGIN;

-- 1. Trigger viejo a NO-OP. El INSERT en test_questions sigue disparando
-- otros 10 triggers (retention, user_stats_summary, etc.) — solo dejamos
-- de marcar dirty porque ya nadie procesa los dirty.
CREATE OR REPLACE FUNCTION public.update_question_difficulty_immediate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- NO-OP. Antes marcaba stats_dirty=true para que el cron
  -- recalc-question-difficulty recalculara `difficulty` desde
  -- test_questions agregando todas las respuestas (incluido retests,
  -- lo que sesgaba el valor). Ese cron fue apagado el 2026-05-17:
  -- el campo `difficulty` queda como categoría inicial de importación
  -- ('medium' por default), sirviendo de fallback estático cuando la
  -- pregunta no tiene primer intento todavía. Con primer intento,
  -- `global_difficulty_category` (mantenido por
  -- apply_first_attempt_to_question_stats_trigger) tiene prioridad.
  RETURN NEW;
END;
$function$;

-- 2. Drop de la función del cron. Ya nadie la llama.
DROP FUNCTION IF EXISTS public.recalculate_dirty_question_difficulty(integer);

COMMIT;
