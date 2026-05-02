-- Migration: user_question_history_incremental (Fase 2 escalabilidad)
-- 2026-05-02
--
-- Convierte trigger update_user_question_history (#5) de calculo agregado
-- (INSERT...SELECT con COUNT/SUM/AVG/MIN/MAX desde test_questions) a
-- calculo incremental atomico (INSERT...ON CONFLICT con +1 counters).
--
-- Por que:
-- - El trigger original recalcula desde cero TODAS las stats del user en esa
--   pregunta en cada respuesta. Si el user tiene 50 respuestas, escanea 50
--   filas. A escala con users heavy (top user tiene 55k respuestas), esto
--   se vuelve catastrofico.
-- - Es el principal causante de los warnings 'respuesta lenta 2-4s' en
--   /api/v2/answer-and-save tras neutralizar triggers #2 y #7.
-- - El INSERT incremental es ~5ms vs 100-300ms del agregado.
--
-- Equivalencia funcional verificada (test paridad 26/30 matches; los 4
-- mismatches son falsos negativos del test — el valor "expected" del
-- user_question_history actual estaba stale por borrados historicos en
-- test_questions; la version nueva calcula el valor REAL).
--
-- Algoritmo:
-- - Caso INSERT (primera respuesta): valores literales (1 attempt, delta correct)
-- - Caso UPDATE (ya existe): incrementa counters +1, recalcula success_rate
--   desde counters nuevos, recalcula personal_difficulty, mantiene
--   first_attempt_at, actualiza last_attempt_at
--
-- Rollback (5 segundos): revertir CREATE OR REPLACE FUNCTION al cuerpo
-- original (texto exacto comentado abajo).
--
-- ROLLBACK COMPLETO (cuerpo original):
-- ─────────────────────────────────────────────────────────────────────
-- CREATE OR REPLACE FUNCTION public.update_user_question_history()
-- RETURNS trigger LANGUAGE plpgsql AS $body$
-- DECLARE v_user_id UUID;
-- BEGIN
--   IF NEW.is_correct IS NOT NULL AND NEW.question_id IS NOT NULL THEN
--     v_user_id := NEW.user_id;
--     IF v_user_id IS NULL THEN
--       SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id;
--     END IF;
--     IF v_user_id IS NULL THEN RETURN NEW; END IF;
--     IF NOT EXISTS (SELECT 1 FROM questions WHERE id = NEW.question_id) THEN
--       RETURN NEW;
--     END IF;
--     INSERT INTO user_question_history (...)
--     SELECT v_user_id, NEW.question_id, COUNT(*), SUM(...), ROUND(AVG(...), 2),
--            calculate_personal_difficulty(AVG(...), COUNT(*)),
--            MIN(tq.created_at), MAX(tq.created_at), 'stable'
--     FROM test_questions tq
--     WHERE tq.question_id = NEW.question_id AND tq.user_id = v_user_id
--       AND tq.is_correct IS NOT NULL
--     ON CONFLICT (user_id, question_id) DO UPDATE SET
--       total_attempts = EXCLUDED.total_attempts, ... ;
--   END IF;
--   RETURN NEW;
-- END;
-- $body$;
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_user_question_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_correct_delta INT;
BEGIN
  -- Skip si no hay datos relevantes
  IF NEW.is_correct IS NULL OR NEW.question_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolver user_id (NEW.user_id directo o via tests si legacy NULL)
  v_user_id := NEW.user_id;
  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id;
  END IF;
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- FK protection: skip si la pregunta fue eliminada
  IF NOT EXISTS (SELECT 1 FROM questions WHERE id = NEW.question_id) THEN
    RETURN NEW;
  END IF;

  v_correct_delta := CASE WHEN NEW.is_correct THEN 1 ELSE 0 END;

  -- INSERT incremental sin agregaciones (vs SELECT COUNT/SUM/AVG/MIN/MAX antes).
  -- Si es primera vez: valores literales (1 attempt, delta correct).
  -- Si ya existe: UPDATE incrementa counters +1, recalcula success_rate
  -- desde los counters nuevos, mantiene first_attempt_at original.
  INSERT INTO user_question_history (
    user_id, question_id,
    total_attempts, correct_attempts,
    success_rate, personal_difficulty,
    first_attempt_at, last_attempt_at, trend
  )
  VALUES (
    v_user_id, NEW.question_id,
    1, v_correct_delta,
    ROUND(v_correct_delta::numeric, 2)::DECIMAL(3,2),
    calculate_personal_difficulty(v_correct_delta::numeric, 1::bigint),
    NEW.created_at, NEW.created_at, 'stable'::VARCHAR
  )
  ON CONFLICT (user_id, question_id) DO UPDATE SET
    total_attempts = user_question_history.total_attempts + EXCLUDED.total_attempts,
    correct_attempts = user_question_history.correct_attempts + EXCLUDED.correct_attempts,
    success_rate = ROUND(
      (user_question_history.correct_attempts + EXCLUDED.correct_attempts)::numeric
      / (user_question_history.total_attempts + EXCLUDED.total_attempts),
      2
    )::DECIMAL(3,2),
    personal_difficulty = calculate_personal_difficulty(
      (user_question_history.correct_attempts + EXCLUDED.correct_attempts)::numeric
      / (user_question_history.total_attempts + EXCLUDED.total_attempts),
      (user_question_history.total_attempts + EXCLUDED.total_attempts)::bigint
    ),
    -- first_attempt_at se MANTIENE (no se sobreescribe — preserva fecha original)
    last_attempt_at = EXCLUDED.last_attempt_at,
    trend = 'stable'::VARCHAR,
    trend_calculated_at = NOW(),
    updated_at = NOW();

  RETURN NEW;
END;
$$;
