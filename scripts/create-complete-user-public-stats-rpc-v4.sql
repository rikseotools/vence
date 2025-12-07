-- Función RPC COMPLETA para obtener TODAS las estadísticas públicas de un usuario
-- Incluye: racha, oposición, actividad de hoy y temas dominados

CREATE OR REPLACE FUNCTION get_user_public_stats(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  total_questions BIGINT,
  correct_answers BIGINT,
  global_accuracy NUMERIC,
  total_tests BIGINT,
  user_created_at TIMESTAMPTZ,
  last_activity_date DATE,
  -- Campos adicionales
  target_oposicion TEXT,
  current_streak INTEGER,
  longest_streak INTEGER,
  today_tests INTEGER,
  today_questions INTEGER,
  today_correct INTEGER,
  mastered_topics INTEGER -- Nuevo: temas con >80% acierto
) AS $$
BEGIN
  RETURN QUERY
  WITH user_stats AS (
    -- Estadísticas generales desde test_questions
    SELECT
      t.user_id,
      COUNT(DISTINCT t.id) as total_tests,
      COUNT(tq.id) as total_questions,
      COUNT(tq.id) FILTER (WHERE tq.is_correct = true) as correct_answers,
      MAX(t.created_at::DATE) as last_activity
    FROM tests t
    LEFT JOIN test_questions tq ON tq.test_id = t.id
    WHERE t.user_id = p_user_id
    GROUP BY t.user_id
  ),
  user_info AS (
    -- Información básica del usuario
    SELECT
      au.id,
      au.created_at,
      up.target_oposicion
    FROM auth.users au
    LEFT JOIN user_profiles up ON up.id = au.id
    WHERE au.id = p_user_id
  ),
  streak_info AS (
    -- Información de racha
    SELECT
      us.user_id,
      us.current_streak,
      us.longest_streak
    FROM user_streaks us
    WHERE us.user_id = p_user_id
  ),
  today_stats AS (
    -- Estadísticas de hoy
    SELECT
      t.user_id,
      COUNT(DISTINCT t.id) as today_tests,
      COUNT(tq.id) as today_questions,
      COUNT(tq.id) FILTER (WHERE tq.is_correct = true) as today_correct
    FROM tests t
    LEFT JOIN test_questions tq ON tq.test_id = t.id
    WHERE t.user_id = p_user_id
      AND t.created_at >= CURRENT_DATE
      AND t.created_at < CURRENT_DATE + INTERVAL '1 day'
    GROUP BY t.user_id
  ),
  topic_stats AS (
    -- Estadísticas por tema para calcular temas dominados
    SELECT
      t.user_id,
      COUNT(DISTINCT tq.tema_number) FILTER (
        WHERE tq.tema_number IS NOT NULL
      ) as total_topics,
      -- Contar temas con más del 80% de acierto
      COUNT(DISTINCT tq.tema_number) FILTER (
        WHERE tq.tema_number IN (
          SELECT tema_number
          FROM test_questions tq2
          INNER JOIN tests t2 ON t2.id = tq2.test_id
          WHERE t2.user_id = p_user_id
            AND tq2.tema_number IS NOT NULL
          GROUP BY tema_number
          HAVING COUNT(*) >= 10 -- Mínimo 10 preguntas del tema
            AND (COUNT(*) FILTER (WHERE is_correct = true))::NUMERIC / COUNT(*)::NUMERIC > 0.80
        )
      ) as mastered_topics
    FROM tests t
    LEFT JOIN test_questions tq ON tq.test_id = t.id
    WHERE t.user_id = p_user_id
    GROUP BY t.user_id
  )
  SELECT
    COALESCE(us.user_id, ui.id) as user_id,
    COALESCE(us.total_questions, 0) as total_questions,
    COALESCE(us.correct_answers, 0) as correct_answers,
    CASE
      WHEN COALESCE(us.total_questions, 0) > 0 THEN
        ROUND((us.correct_answers::NUMERIC / us.total_questions::NUMERIC) * 100, 1)
      ELSE 0
    END as global_accuracy,
    COALESCE(us.total_tests, 0) as total_tests,
    ui.created_at as user_created_at,
    us.last_activity as last_activity_date,
    -- Campos adicionales
    ui.target_oposicion,
    COALESCE(si.current_streak, 0) as current_streak,
    COALESCE(si.longest_streak, 0) as longest_streak,
    COALESCE(ts.today_tests, 0) as today_tests,
    COALESCE(ts.today_questions, 0) as today_questions,
    COALESCE(ts.today_correct, 0) as today_correct,
    COALESCE(tps.mastered_topics, 0) as mastered_topics
  FROM user_info ui
  LEFT JOIN user_stats us ON ui.id = us.user_id
  LEFT JOIN streak_info si ON ui.id = si.user_id
  LEFT JOIN today_stats ts ON ui.id = ts.user_id
  LEFT JOIN topic_stats tps ON ui.id = tps.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos de ejecución
GRANT EXECUTE ON FUNCTION get_user_public_stats(UUID) TO authenticated;

-- Comentario descriptivo
COMMENT ON FUNCTION get_user_public_stats IS 'Obtiene TODAS las estadísticas públicas incluyendo temas dominados (>80% con mínimo 10 preguntas)';

-- ========================================
-- Test de la función con Nila
-- ========================================
-- SELECT * FROM get_user_public_stats('c16c186a-4e70-4b1e-a3bd-c107e13670dd');