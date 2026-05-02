-- Migration: questions_difficulty_debounced_fix_lock (Fase 0.2 hotfix)
-- 2026-05-02 — fix de bug encontrado en producción tras aplicar la migración inicial
--
-- BUG: La versión inicial usaba pg_try_advisory_lock + pg_advisory_unlock
-- (session-level locks). Cuando la función falla por statement_timeout, el
-- bloque EXCEPTION puede no ejecutarse, dejando el lock huérfano. PostgREST
-- mantiene conexiones idle persistentes → el lock NO se libera y bloquea a
-- ejecuciones posteriores del cron indefinidamente.
--
-- Sintoma observado: 1715 preguntas dirty acumuladas en 3h, cron devolvía
-- "statement timeout" → lock retenido → siguientes ejecuciones recibían -1.
--
-- FIX: Usar pg_try_advisory_xact_lock (TRANSACTION-level) que se libera
-- AUTOMÁTICAMENTE al terminar la transacción (commit, rollback, error,
-- timeout — siempre). No hace falta unlock explícito.
--
-- Cambios adicionales:
-- - LIMIT default bajado de 500 a 200 → tiempo seguro <30s incluso con
--   contención concurrente. 200 cada 5min = 2400/h = capacidad sobrada
--   para el ritmo actual de ~100 dirty/h en producción.
-- - Eliminado bloque BEGIN/EXCEPTION/END manual (innecesario sin lock cleanup).
--
-- Idempotente.

CREATE OR REPLACE FUNCTION public.recalculate_dirty_question_difficulty(
  p_limit integer DEFAULT 200
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lock_acquired BOOLEAN;
  v_processed INTEGER := 0;
  v_question_id UUID;
  v_success_rate NUMERIC;
  v_total_attempts INTEGER;
  v_avg_time NUMERIC;
  v_avg_confidence NUMERIC;
  v_new_difficulty TEXT;
  v_difficulty_score NUMERIC;
BEGIN
  -- xact_lock: se libera AUTOMÁTICAMENTE al terminar la transacción
  -- (commit, rollback, statement_timeout). Evita locks huérfanos.
  v_lock_acquired := pg_try_advisory_xact_lock(hashtext('recalc_question_difficulty'));
  IF NOT v_lock_acquired THEN
    RETURN -1;
  END IF;

  FOR v_question_id IN
    SELECT id FROM questions WHERE stats_dirty = true ORDER BY id LIMIT p_limit
  LOOP
    SELECT
      COUNT(*),
      AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) * 100,
      AVG(time_spent_seconds),
      AVG(CASE confidence_level
        WHEN 'very_sure' THEN 4.0 WHEN 'sure' THEN 3.0
        WHEN 'unsure' THEN 2.0 WHEN 'guessing' THEN 1.0 ELSE 2.5 END)
    INTO v_total_attempts, v_success_rate, v_avg_time, v_avg_confidence
    FROM test_questions WHERE question_id = v_question_id;

    IF v_total_attempts IS NULL OR v_total_attempts = 0 THEN
      UPDATE questions SET stats_dirty = false WHERE id = v_question_id;
      CONTINUE;
    END IF;

    v_difficulty_score := (100 - v_success_rate) * 0.5
      + CASE WHEN v_avg_time > 120 THEN 25 WHEN v_avg_time > 90 THEN 15
             WHEN v_avg_time > 60 THEN 8 ELSE 0 END
      + CASE WHEN v_avg_confidence < 2.0 THEN 25 WHEN v_avg_confidence < 2.5 THEN 15
             WHEN v_avg_confidence < 3.0 THEN 8 ELSE 0 END;

    v_new_difficulty := CASE WHEN v_difficulty_score >= 75 THEN 'extreme'
      WHEN v_difficulty_score >= 50 THEN 'hard'
      WHEN v_difficulty_score >= 25 THEN 'medium' ELSE 'easy' END;

    UPDATE questions
    SET difficulty = v_new_difficulty, updated_at = NOW(), stats_dirty = false
    WHERE id = v_question_id;

    v_processed := v_processed + 1;
  END LOOP;

  -- xact_lock se libera al fin de transacción (no hay unlock explícito).
  RETURN v_processed;
END;
$$;
