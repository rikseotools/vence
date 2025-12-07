-- Corregir tipos de la función RPC - usar BIGINT en lugar de INTEGER
DROP FUNCTION IF EXISTS get_user_public_stats(uuid);

CREATE OR REPLACE FUNCTION get_user_public_stats(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  total_questions BIGINT,
  correct_answers BIGINT,
  global_accuracy NUMERIC,
  total_tests BIGINT,
  user_created_at TIMESTAMPTZ,
  last_activity_date DATE,
  target_oposicion TEXT,
  current_streak BIGINT,  -- Cambiado de INTEGER a BIGINT
  longest_streak BIGINT,  -- Cambiado de INTEGER a BIGINT
  today_tests BIGINT,     -- Cambiado de INTEGER a BIGINT
  today_questions BIGINT,  -- Cambiado de INTEGER a BIGINT
  today_correct BIGINT,    -- Cambiado de INTEGER a BIGINT
  mastered_topics BIGINT   -- Cambiado de INTEGER a BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_stats AS (
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
    SELECT
      au.id,
      au.created_at,
      up.target_oposicion
    FROM auth.users au
    LEFT JOIN user_profiles up ON up.id = au.id
    WHERE au.id = p_user_id
  ),
  streak_info AS (
    SELECT
      us.user_id,
      us.current_streak::BIGINT,  -- Cast explícito a BIGINT
      us.longest_streak::BIGINT   -- Cast explícito a BIGINT
    FROM user_streaks us
    WHERE us.user_id = p_user_id
  ),
  today_stats AS (
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
    SELECT
      p_user_id as user_id,
      COUNT(DISTINCT subq.tema_number)::BIGINT as mastered_topics
    FROM (
      SELECT tq2.tema_number
      FROM test_questions tq2
      INNER JOIN tests t2 ON t2.id = tq2.test_id
      WHERE t2.user_id = p_user_id
        AND tq2.tema_number IS NOT NULL
      GROUP BY tq2.tema_number
      HAVING COUNT(*) >= 10
        AND (COUNT(*) FILTER (WHERE tq2.is_correct = true))::NUMERIC / COUNT(*)::NUMERIC > 0.80
    ) subq
  )
  SELECT
    COALESCE(us.user_id, ui.id) as user_id,
    COALESCE(us.total_questions, 0)::BIGINT as total_questions,
    COALESCE(us.correct_answers, 0)::BIGINT as correct_answers,
    CASE
      WHEN COALESCE(us.total_questions, 0) > 0 THEN
        ROUND((us.correct_answers::NUMERIC / us.total_questions::NUMERIC) * 100, 1)
      ELSE 0
    END as global_accuracy,
    COALESCE(us.total_tests, 0)::BIGINT as total_tests,
    ui.created_at as user_created_at,
    us.last_activity as last_activity_date,
    ui.target_oposicion,
    COALESCE(si.current_streak, 0)::BIGINT as current_streak,
    COALESCE(si.longest_streak, 0)::BIGINT as longest_streak,
    COALESCE(ts.today_tests, 0)::BIGINT as today_tests,
    COALESCE(ts.today_questions, 0)::BIGINT as today_questions,
    COALESCE(ts.today_correct, 0)::BIGINT as today_correct,
    COALESCE(tps.mastered_topics, 0)::BIGINT as mastered_topics
  FROM user_info ui
  LEFT JOIN user_stats us ON ui.id = us.user_id
  LEFT JOIN streak_info si ON ui.id = si.user_id
  LEFT JOIN today_stats ts ON ui.id = ts.user_id
  LEFT JOIN topic_stats tps ON tps.user_id = ui.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_public_stats(UUID) TO authenticated;

COMMENT ON FUNCTION get_user_public_stats IS 'Obtiene estadísticas públicas completas con tipos BIGINT consistentes';