-- Migration: init_user_stats_summary_trigger
-- 2026-05-01
--
-- Bug detectado: 1.171 usuarios (27.2% del total) sin fila en
-- user_stats_summary porque el trigger update_user_stats_summary_trigger
-- solo dispara en INSERT a test_questions. Users que se registran pero
-- nunca responden preguntas no consiguen fila → cada hit a /api/v2/user-stats
-- cae al fallback "computing" que tiene un bug (INSERT...SELECT...GROUP BY
-- sobre 0 filas inserta 0 filas) → bucle infinito de warnings.
--
-- Solución: trigger AFTER INSERT en user_profiles que crea fila default
-- (todo 0) en user_stats_summary desde el signup. Garantía estructural —
-- todos los users tienen su fila desde el momento de registro.
--
-- Defensa en profundidad: el código del fallback (lib/api/user-stats/
-- queries.ts:51-71) también se arregla en commit asociado para que sin
-- GROUP BY siempre inserte 1 fila (race conditions, trigger droppeado, etc).
--
-- Idempotente: re-ejecutable sin efectos secundarios.

-- ============================================
-- 1. Función que crea la fila default
-- ============================================
CREATE OR REPLACE FUNCTION init_user_stats_summary()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO user_stats_summary (
    user_id, total_questions, correct_answers, blank_answers, questions_this_week, week_start
  )
  VALUES (
    NEW.id, 0, 0, 0, 0, date_trunc('week', now())::date
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. Trigger sobre user_profiles
-- ============================================
DROP TRIGGER IF EXISTS init_user_stats_summary_on_signup ON user_profiles;

CREATE TRIGGER init_user_stats_summary_on_signup
AFTER INSERT ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION init_user_stats_summary();

-- ============================================
-- 3. Backfill de filas faltantes
-- ============================================
INSERT INTO user_stats_summary (
  user_id, total_questions, correct_answers, blank_answers, questions_this_week, week_start
)
SELECT up.id, 0, 0, 0, 0, date_trunc('week', now())::date
FROM user_profiles up
WHERE NOT EXISTS (
  SELECT 1 FROM user_stats_summary uss WHERE uss.user_id = up.id
)
ON CONFLICT (user_id) DO NOTHING;
