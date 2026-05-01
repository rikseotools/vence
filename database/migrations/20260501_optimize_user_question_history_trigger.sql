-- 20260501: Optimizar trigger update_user_question_history
-- Problema: el trigger hacía JOIN tests para obtener user_id, cuando test_questions
-- ya tiene columna user_id. El JOIN costaba 5-500ms por INSERT dependiendo del usuario.
-- Con 12 usuarios simultáneos, saturaba las conexiones del pooler → cascada de 504s.
-- Fix: usar NEW.user_id directamente (con fallback a tests.user_id para filas legacy).
-- Resultado: INSERT para Nila (55k filas) baja de 577ms a 62ms.

CREATE OR REPLACE FUNCTION update_user_question_history()
RETURNS TRIGGER AS $func$
DECLARE
  v_user_id UUID;
BEGIN
  IF NEW.is_correct IS NOT NULL AND NEW.question_id IS NOT NULL THEN
    -- Usar user_id de test_questions directamente (sin JOIN a tests)
    v_user_id := NEW.user_id;

    -- Fallback a tests si user_id es null en test_questions (legacy)
    IF v_user_id IS NULL THEN
      SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id;
    END IF;

    IF v_user_id IS NULL THEN
      RETURN NEW;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM questions WHERE id = NEW.question_id) THEN
      RETURN NEW;
    END IF;

    INSERT INTO user_question_history (
      user_id, question_id, total_attempts, correct_attempts,
      success_rate, personal_difficulty, first_attempt_at, last_attempt_at, trend
    )
    SELECT
      v_user_id,
      NEW.question_id,
      COUNT(*)::INTEGER,
      SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::INTEGER,
      ROUND(AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END), 2)::DECIMAL(3,2),
      calculate_personal_difficulty(
        AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END)::NUMERIC,
        COUNT(*)::BIGINT
      ),
      MIN(tq.created_at),
      MAX(tq.created_at),
      'stable'::VARCHAR
    FROM test_questions tq
    WHERE tq.question_id = NEW.question_id
      AND tq.user_id = v_user_id
      AND tq.is_correct IS NOT NULL
    ON CONFLICT (user_id, question_id)
    DO UPDATE SET
      total_attempts = EXCLUDED.total_attempts,
      correct_attempts = EXCLUDED.correct_attempts,
      success_rate = EXCLUDED.success_rate,
      personal_difficulty = EXCLUDED.personal_difficulty,
      first_attempt_at = EXCLUDED.first_attempt_at,
      last_attempt_at = EXCLUDED.last_attempt_at,
      trend = EXCLUDED.trend,
      trend_calculated_at = NOW(),
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;
