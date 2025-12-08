-- ARREGLAR LA FUNCIÓN RPC get_user_public_stats PARA CALCULAR CORRECTAMENTE MASTERED_TOPICS

-- Primero eliminar la función antigua
DROP FUNCTION IF EXISTS get_user_public_stats(UUID);

-- Crear la función corregida
CREATE OR REPLACE FUNCTION get_user_public_stats(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  user_created_at TIMESTAMP WITH TIME ZONE,
  total_questions INTEGER,
  correct_answers INTEGER,
  global_accuracy NUMERIC,
  total_tests INTEGER,
  current_streak INTEGER,
  longest_streak INTEGER,
  target_oposicion TEXT,
  mastered_topics INTEGER,
  total_topics INTEGER,
  last_activity TIMESTAMP WITH TIME ZONE,
  study_days INTEGER,
  total_study_time INTEGER,
  average_time_per_question NUMERIC,
  best_performance_time TEXT,
  favorite_topics TEXT[],
  weak_areas TEXT[],
  improvement_rate NUMERIC,
  predicted_score NUMERIC,
  study_consistency NUMERIC,
  total_tests_completed INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p_user_id as user_id,
    up.created_at as user_created_at,
    COALESCE(COUNT(DISTINCT tq.id), 0)::INTEGER as total_questions,
    COALESCE(COUNT(DISTINCT tq.id) FILTER (WHERE tq.is_correct = true), 0)::INTEGER as correct_answers,
    CASE
      WHEN COUNT(DISTINCT tq.id) > 0 THEN
        ROUND((COUNT(DISTINCT tq.id) FILTER (WHERE tq.is_correct = true)::NUMERIC * 100.0) / COUNT(DISTINCT tq.id)::NUMERIC, 2)
      ELSE 0
    END as global_accuracy,
    COUNT(DISTINCT t.id)::INTEGER as total_tests,
    COALESCE(user_streaks.current_streak, 0)::INTEGER as current_streak,
    COALESCE(user_streaks.longest_streak, 0)::INTEGER as longest_streak,
    up.target_oposicion as target_oposicion,

    -- CALCULAR MASTERED_TOPICS CORRECTAMENTE (NO hardcodeado a 0)
    COALESCE((
      SELECT COUNT(DISTINCT tema_number)::INTEGER
      FROM (
        SELECT
          tq2.tema_number,
          COUNT(*) as total_tema_questions,
          SUM(CASE WHEN tq2.is_correct THEN 1 ELSE 0 END) as correct_tema_questions,
          CASE
            WHEN COUNT(*) >= 10 AND
                 (SUM(CASE WHEN tq2.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100.0 / COUNT(*)::NUMERIC) >= 85
            THEN 1
            ELSE 0
          END as is_mastered
        FROM test_questions tq2
        JOIN tests t2 ON t2.id = tq2.test_id
        WHERE t2.user_id = p_user_id
          AND tq2.tema_number IS NOT NULL
        GROUP BY tq2.tema_number
      ) tema_stats
      WHERE is_mastered = 1
    ), 0)::INTEGER as mastered_topics,

    -- Total de temas (28 para auxiliar administrativo)
    28::INTEGER as total_topics,

    MAX(t.created_at) as last_activity,
    COUNT(DISTINCT DATE(t.created_at))::INTEGER as study_days,
    COALESCE(SUM(tq.time_spent_seconds), 0)::INTEGER as total_study_time,
    CASE
      WHEN COUNT(tq.id) > 0 THEN
        ROUND(AVG(tq.time_spent_seconds)::NUMERIC, 2)
      ELSE 0
    END as average_time_per_question,

    CASE
      WHEN COUNT(tq.id) FILTER (WHERE EXTRACT(HOUR FROM tq.answered_at) BETWEEN 6 AND 11) >
           COUNT(tq.id) FILTER (WHERE EXTRACT(HOUR FROM tq.answered_at) BETWEEN 18 AND 23)
      THEN 'morning'
      WHEN COUNT(tq.id) FILTER (WHERE EXTRACT(HOUR FROM tq.answered_at) BETWEEN 18 AND 23) >
           COUNT(tq.id) FILTER (WHERE EXTRACT(HOUR FROM tq.answered_at) BETWEEN 12 AND 17)
      THEN 'evening'
      ELSE 'afternoon'
    END as best_performance_time,

    ARRAY[]::TEXT[] as favorite_topics,
    ARRAY[]::TEXT[] as weak_areas,
    0::NUMERIC as improvement_rate,
    0::NUMERIC as predicted_score,

    CASE
      WHEN COUNT(DISTINCT DATE(t.created_at)) > 0 AND
           (CURRENT_DATE - MIN(DATE(t.created_at))::DATE + 1) > 0 THEN
        ROUND((COUNT(DISTINCT DATE(t.created_at))::NUMERIC * 100.0) /
              (CURRENT_DATE - MIN(DATE(t.created_at))::DATE + 1)::NUMERIC, 2)
      ELSE 0
    END as study_consistency,

    -- AÑADIR total_tests_completed (tests completados)
    COUNT(DISTINCT t.id) FILTER (WHERE t.is_completed = true)::INTEGER as total_tests_completed

  FROM user_profiles up
  LEFT JOIN tests t ON t.user_id = up.id
  LEFT JOIN test_questions tq ON tq.test_id = t.id
  LEFT JOIN user_streaks ON user_streaks.user_id = up.id
  WHERE up.id = p_user_id
  GROUP BY up.id, up.created_at, up.target_oposicion, user_streaks.current_streak, user_streaks.longest_streak;
END;
$$;

-- Verificar que funciona correctamente con el usuario EM
SELECT
  user_id,
  total_questions,
  global_accuracy,
  mastered_topics,
  total_topics,
  total_tests_completed,
  current_streak,
  longest_streak
FROM get_user_public_stats(
  (SELECT id FROM user_profiles up
   LEFT JOIN public_user_profiles pup ON pup.id = up.id
   WHERE pup.ciudad = 'Palencia' AND pup.display_name = 'EM'
   LIMIT 1)
);