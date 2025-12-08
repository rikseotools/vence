-- CREAR RPC PARA CALCULAR ESTADÍSTICAS COMPLETAS SIN TIMEOUT

CREATE OR REPLACE FUNCTION get_user_complete_stats(p_user_id UUID)
RETURNS TABLE (
  -- Estadísticas generales
  total_questions INTEGER,
  correct_answers INTEGER,
  global_accuracy NUMERIC,
  total_tests INTEGER,
  completed_tests INTEGER,

  -- Por tema
  tema_stats JSONB,

  -- Por ley
  law_stats JSONB,

  -- Por dificultad
  difficulty_stats JSONB,

  -- Tendencias temporales
  monthly_stats JSONB,
  weekly_progress JSONB,

  -- Tiempo de estudio
  total_study_time INTEGER,
  average_time_per_question NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_responses AS (
    SELECT
      tq.*,
      t.created_at as test_date,
      t.is_completed
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    WHERE t.user_id = p_user_id
  ),

  tema_calculations AS (
    SELECT
      tema_number,
      COUNT(*) as total,
      SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
      ROUND(
        SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::NUMERIC * 100.0 /
        COUNT(*)::NUMERIC, 2
      ) as accuracy
    FROM user_responses
    WHERE tema_number IS NOT NULL
    GROUP BY tema_number
  ),

  law_calculations AS (
    SELECT
      law_name,
      COUNT(*) as total,
      SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
      ROUND(
        SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::NUMERIC * 100.0 /
        COUNT(*)::NUMERIC, 2
      ) as accuracy
    FROM user_responses
    WHERE law_name IS NOT NULL
    GROUP BY law_name
  ),

  difficulty_calculations AS (
    SELECT
      difficulty,
      COUNT(*) as total,
      SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct
    FROM user_responses
    WHERE difficulty IS NOT NULL
    GROUP BY difficulty
  ),

  monthly_calculations AS (
    SELECT
      TO_CHAR(test_date, 'YYYY-MM') as month,
      COUNT(*) as total,
      SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
      ROUND(
        SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::NUMERIC * 100.0 /
        COUNT(*)::NUMERIC, 2
      ) as accuracy
    FROM user_responses
    GROUP BY TO_CHAR(test_date, 'YYYY-MM')
    ORDER BY month DESC
    LIMIT 12
  ),

  weekly_calculations AS (
    SELECT
      DATE_TRUNC('week', test_date) as week,
      COUNT(*) as total,
      SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct
    FROM user_responses
    WHERE test_date >= NOW() - INTERVAL '8 weeks'
    GROUP BY DATE_TRUNC('week', test_date)
    ORDER BY week DESC
  )

  SELECT
    -- Estadísticas generales
    COUNT(*)::INTEGER as total_questions,
    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::INTEGER as correct_answers,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND(
          SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::NUMERIC * 100.0 /
          COUNT(*)::NUMERIC, 2
        )
      ELSE 0
    END as global_accuracy,
    COUNT(DISTINCT test_id)::INTEGER as total_tests,
    COUNT(DISTINCT CASE WHEN is_completed THEN test_id END)::INTEGER as completed_tests,

    -- Por tema (como JSON)
    (SELECT JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'tema', tema_number,
        'total', total,
        'correct', correct,
        'accuracy', accuracy,
        'mastered', CASE WHEN total >= 10 AND accuracy > 80 THEN true ELSE false END
      ) ORDER BY tema_number
    ) FROM tema_calculations),

    -- Por ley (como JSON)
    (SELECT JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'law', law_name,
        'total', total,
        'correct', correct,
        'accuracy', accuracy
      ) ORDER BY total DESC
    ) FROM law_calculations),

    -- Por dificultad (como JSON)
    (SELECT JSONB_BUILD_OBJECT(
      'easy', COALESCE((SELECT total FROM difficulty_calculations WHERE difficulty = 'easy'), 0),
      'medium', COALESCE((SELECT total FROM difficulty_calculations WHERE difficulty = 'medium'), 0),
      'hard', COALESCE((SELECT total FROM difficulty_calculations WHERE difficulty = 'hard'), 0),
      'easy_correct', COALESCE((SELECT correct FROM difficulty_calculations WHERE difficulty = 'easy'), 0),
      'medium_correct', COALESCE((SELECT correct FROM difficulty_calculations WHERE difficulty = 'medium'), 0),
      'hard_correct', COALESCE((SELECT correct FROM difficulty_calculations WHERE difficulty = 'hard'), 0)
    )),

    -- Tendencias mensuales (como JSON)
    (SELECT JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'month', month,
        'total', total,
        'correct', correct,
        'accuracy', accuracy
      ) ORDER BY month DESC
    ) FROM monthly_calculations),

    -- Progreso semanal (como JSON)
    (SELECT JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'week', week,
        'total', total,
        'correct', correct
      ) ORDER BY week DESC
    ) FROM weekly_calculations),

    -- Tiempo de estudio
    COALESCE(SUM(time_spent_seconds), 0)::INTEGER as total_study_time,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND(AVG(time_spent_seconds)::NUMERIC, 2)
      ELSE 0
    END as average_time_per_question

  FROM user_responses;
END;
$$;

-- Probar con el usuario de ejemplo
SELECT * FROM get_user_complete_stats(
  (SELECT id FROM user_profiles LIMIT 1)
);