-- FIX: Añadir cálculo de temas dominados a la función get_user_public_stats
-- Un tema se considera dominado cuando el usuario tiene:
-- - Mínimo 10 preguntas respondidas del tema
-- - Más del 80% de acierto en ese tema

-- Primero, verificar qué versión de la función existe actualmente
SELECT
  proname AS function_name,
  pg_get_function_result(oid) AS return_type,
  pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname = 'get_user_public_stats';

-- Actualizar la función para incluir mastered_topics
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
  current_streak INTEGER,
  longest_streak INTEGER,
  today_tests INTEGER,
  today_questions INTEGER,
  today_correct INTEGER,
  mastered_topics INTEGER,
  accuracy_this_week NUMERIC,
  accuracy_last_month NUMERIC,
  accuracy_three_months_ago NUMERIC,
  questions_this_week INTEGER
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
    -- Usar valores de user_streaks directamente
    SELECT
      us.user_id,
      us.current_streak,
      us.longest_streak
    FROM user_streaks us
    WHERE us.user_id = p_user_id
  ),
  today_stats AS (
    -- Estadísticas de hoy usando test_questions.created_at
    SELECT
      t.user_id,
      COUNT(DISTINCT t.id) as today_tests,
      COUNT(tq.id) as today_questions,
      COUNT(tq.id) FILTER (WHERE tq.is_correct = true) as today_correct
    FROM tests t
    LEFT JOIN test_questions tq ON tq.test_id = t.id
    WHERE t.user_id = p_user_id
      AND tq.created_at >= CURRENT_DATE AT TIME ZONE 'UTC'
      AND tq.created_at < (CURRENT_DATE + INTERVAL '1 day') AT TIME ZONE 'UTC'
    GROUP BY t.user_id
  ),
  topic_stats AS (
    -- NUEVO: Estadísticas por tema para calcular temas dominados
    SELECT
      t.user_id,
      -- Contar temas con más del 80% de acierto y mínimo 10 preguntas
      COUNT(DISTINCT tema_stats.tema_number) as mastered_topics
    FROM tests t
    CROSS JOIN LATERAL (
      SELECT
        tq.tema_number,
        COUNT(*) as total_tema,
        COUNT(*) FILTER (WHERE tq.is_correct = true) as correct_tema
      FROM test_questions tq
      INNER JOIN tests t2 ON t2.id = tq.test_id
      WHERE t2.user_id = p_user_id
        AND tq.tema_number IS NOT NULL
      GROUP BY tq.tema_number
      HAVING COUNT(*) >= 10 -- Mínimo 10 preguntas
        AND (COUNT(*) FILTER (WHERE tq.is_correct = true))::NUMERIC / COUNT(*)::NUMERIC > 0.80 -- Más del 80%
    ) tema_stats
    WHERE t.user_id = p_user_id
    GROUP BY t.user_id
  ),
  week_stats AS (
    -- Estadísticas de la última semana
    SELECT
      t.user_id,
      COUNT(tq.id) as week_questions,
      COUNT(tq.id) FILTER (WHERE tq.is_correct = true) as week_correct,
      CASE
        WHEN COUNT(tq.id) > 0 THEN
          ROUND((COUNT(tq.id) FILTER (WHERE tq.is_correct = true))::NUMERIC / COUNT(tq.id)::NUMERIC * 100, 1)
        ELSE NULL
      END as week_accuracy
    FROM tests t
    LEFT JOIN test_questions tq ON tq.test_id = t.id
    WHERE t.user_id = p_user_id
      AND tq.created_at >= (CURRENT_DATE - INTERVAL '7 days') AT TIME ZONE 'UTC'
    GROUP BY t.user_id
  ),
  month_stats AS (
    -- Estadísticas del último mes
    SELECT
      t.user_id,
      CASE
        WHEN COUNT(tq.id) > 0 THEN
          ROUND((COUNT(tq.id) FILTER (WHERE tq.is_correct = true))::NUMERIC / COUNT(tq.id)::NUMERIC * 100, 1)
        ELSE NULL
      END as month_accuracy
    FROM tests t
    LEFT JOIN test_questions tq ON tq.test_id = t.id
    WHERE t.user_id = p_user_id
      AND tq.created_at >= (CURRENT_DATE - INTERVAL '30 days') AT TIME ZONE 'UTC'
      AND tq.created_at < (CURRENT_DATE - INTERVAL '7 days') AT TIME ZONE 'UTC'
    GROUP BY t.user_id
  ),
  three_month_stats AS (
    -- Estadísticas de hace 3 meses
    SELECT
      t.user_id,
      CASE
        WHEN COUNT(tq.id) > 0 THEN
          ROUND((COUNT(tq.id) FILTER (WHERE tq.is_correct = true))::NUMERIC / COUNT(tq.id)::NUMERIC * 100, 1)
        ELSE NULL
      END as three_month_accuracy
    FROM tests t
    LEFT JOIN test_questions tq ON tq.test_id = t.id
    WHERE t.user_id = p_user_id
      AND tq.created_at >= (CURRENT_DATE - INTERVAL '90 days') AT TIME ZONE 'UTC'
      AND tq.created_at < (CURRENT_DATE - INTERVAL '60 days') AT TIME ZONE 'UTC'
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
    ui.target_oposicion,
    COALESCE(si.current_streak, 0) as current_streak,
    COALESCE(si.longest_streak, 0) as longest_streak,
    COALESCE(ts.today_tests, 0) as today_tests,
    COALESCE(ts.today_questions, 0) as today_questions,
    COALESCE(ts.today_correct, 0) as today_correct,
    COALESCE(tps.mastered_topics, 0) as mastered_topics, -- NUEVO
    ws.week_accuracy as accuracy_this_week,
    ms.month_accuracy as accuracy_last_month,
    tms.three_month_accuracy as accuracy_three_months_ago,
    COALESCE(ws.week_questions, 0) as questions_this_week
  FROM user_info ui
  LEFT JOIN user_stats us ON ui.id = us.user_id
  LEFT JOIN streak_info si ON ui.id = si.user_id
  LEFT JOIN today_stats ts ON ui.id = ts.user_id
  LEFT JOIN topic_stats tps ON ui.id = tps.user_id -- NUEVO
  LEFT JOIN week_stats ws ON ui.id = ws.user_id
  LEFT JOIN month_stats ms ON ui.id = ms.user_id
  LEFT JOIN three_month_stats tms ON ui.id = tms.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos de ejecución
GRANT EXECUTE ON FUNCTION get_user_public_stats(UUID) TO authenticated;

-- Comentario descriptivo
COMMENT ON FUNCTION get_user_public_stats IS 'Obtiene todas las estadísticas públicas incluyendo temas dominados (>80% con mínimo 10 preguntas)';

-- ========================================
-- Test de la función con Nila
-- ========================================
SELECT * FROM get_user_public_stats('c16c186a-4e70-4b1e-a3bd-c107e13670dd');