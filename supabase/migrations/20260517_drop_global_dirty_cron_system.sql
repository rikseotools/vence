-- Fase 2-bis paso 3 — Apagar el sistema viejo de global_dirty + cron.
--
-- Tras 24h con el trigger apply_first_attempt_to_question_stats (paso 1) +
-- hardening self-healing (re-aggregate), el cron viejo recalc-global-difficulty
-- es 100% redundante: el trigger nuevo actualiza global_difficulty inmediato
-- y cualquier drift se corrige solo en el siguiente INSERT.
--
-- Esta migración:
--   1. Modifica track_question_first_attempt para NO marcar global_dirty.
--      El INSERT a question_first_attempts sigue intacto — sigue disparando
--      el trigger nuevo que actualiza global_difficulty correctamente.
--   2. DROPs la función recalculate_dirty_global_difficulty (ya nadie la
--      llama: el cron /api/cron/recalc-global-difficulty se elimina en el
--      mismo PR, junto con el workflow GHA y la entrada vercel.json).
--
-- NO se elimina la columna `questions.global_dirty` en este PR — se hace
-- en una migración aparte tras 48h, por margen de seguridad si algún code
-- residual la lee.

BEGIN;

-- 1. Trigger viejo: eliminar el UPDATE global_dirty. INSERT a
-- question_first_attempts intacto (sigue disparando el trigger nuevo).

CREATE OR REPLACE FUNCTION public.track_question_first_attempt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_is_first_attempt BOOLEAN;
BEGIN
  -- Skip si psychometric o question_id null
  IF NEW.psychometric_question_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.question_id IS NULL THEN RETURN NEW; END IF;

  -- Resolver user_id desde tests (si NEW.user_id no está set)
  SELECT user_id INTO v_user_id FROM public.tests WHERE id = NEW.test_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  -- Verificar primer intento (PK lookup, rápido con índice)
  SELECT NOT EXISTS (
    SELECT 1 FROM public.question_first_attempts
    WHERE user_id = v_user_id AND question_id = NEW.question_id
  ) INTO v_is_first_attempt;

  IF v_is_first_attempt THEN
    -- INSERT atómico. Dispara el trigger
    -- apply_first_attempt_to_question_stats_trigger que recalcula
    -- global_difficulty inmediatamente. Ver
    -- supabase/migrations/20260517_global_difficulty_robust_trigger.sql.
    INSERT INTO public.question_first_attempts (
      user_id, question_id, is_correct, time_spent_seconds, confidence_level, created_at
    ) VALUES (
      v_user_id, NEW.question_id, NEW.is_correct, NEW.time_spent_seconds,
      NEW.confidence_level, NOW()
    )
    ON CONFLICT (user_id, question_id) DO NOTHING;

    -- Eliminado UPDATE questions SET global_dirty = true: el sistema
    -- de dirty flag + cron recalc-global-difficulty queda apagado en
    -- esta misma migración (Fase 2-bis paso 3, 2026-05-17).
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Drop de la función del cron viejo. Ya nadie la llama.
DROP FUNCTION IF EXISTS public.recalculate_dirty_global_difficulty(integer);

COMMIT;
