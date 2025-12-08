-- Fix para get_user_public_stats: calcular correctamente mastered_topics y total_tests_completed
-- Problema identificado: mastered_topics está hardcodeado a 0 y total_tests_completed podría estar mal calculado

-- Actualizar la función get_user_public_stats para calcular correctamente los temas dominados
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
  accuracy_this_week NUMERIC,
  accuracy_last_month NUMERIC,
  accuracy_three_months_ago NUMERIC,
  today_tests INTEGER,
  today_questions INTEGER,
  today_correct INTEGER,
  total_tests_completed INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_stats AS (
    SELECT
      up.id,
      up.created_at as user_created_at,
      -- Contar preguntas desde test_questions
      COALESCE(COUNT(DISTINCT tq.id), 0)::INTEGER as total_questions,
      COALESCE(SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END), 0)::INTEGER as correct_answers,
      CASE
        WHEN COUNT(tq.id) > 0 THEN
          ROUND(SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100 / COUNT(tq.id)::NUMERIC, 1)
        ELSE 0
      END as global_accuracy,
      -- Contar tests únicos
      COALESCE(COUNT(DISTINCT t.id), 0)::INTEGER as total_tests,
      up.target_oposicion
    FROM user_profiles up
    LEFT JOIN tests t ON t.user_id = up.id
    LEFT JOIN test_questions tq ON tq.test_id = t.id
    WHERE up.id = p_user_id
    GROUP BY up.id, up.created_at, up.target_oposicion
  ),
  today_stats AS (
    SELECT
      COUNT(DISTINCT t.id)::INTEGER as today_tests,
      COUNT(DISTINCT tq.id)::INTEGER as today_questions,
      SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::INTEGER as today_correct
    FROM tests t
    LEFT JOIN test_questions tq ON tq.test_id = t.id
    WHERE t.user_id = p_user_id
      AND DATE(t.created_at) = CURRENT_DATE
  ),
  topic_mastery AS (
    -- Calcular temas dominados (>80% precisión con mínimo 10 preguntas)
    SELECT
      COUNT(DISTINCT tema_stats.tema_number)::INTEGER as mastered_count
    FROM (
      SELECT
        tq.tema_number,
        COUNT(*) as total_preguntas,
        SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) as correctas
      FROM test_questions tq
      INNER JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = p_user_id
        AND tq.tema_number IS NOT NULL
      GROUP BY tq.tema_number
      HAVING COUNT(*) >= 10  -- Mínimo 10 preguntas del tema
        AND (SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)::NUMERIC) > 0.80  -- Más del 80% de acierto
    ) tema_stats
  ),
  accuracy_periods AS (
    SELECT
      -- Esta semana
      CASE
        WHEN COUNT(CASE WHEN tq.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) > 0 THEN
          ROUND(SUM(CASE WHEN tq.created_at >= NOW() - INTERVAL '7 days' AND tq.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100 /
                COUNT(CASE WHEN tq.created_at >= NOW() - INTERVAL '7 days' THEN 1 END)::NUMERIC, 1)
        ELSE NULL
      END as accuracy_this_week,
      -- Último mes
      CASE
        WHEN COUNT(CASE WHEN tq.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) > 0 THEN
          ROUND(SUM(CASE WHEN tq.created_at >= NOW() - INTERVAL '30 days' AND tq.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100 /
                COUNT(CASE WHEN tq.created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::NUMERIC, 1)
        ELSE NULL
      END as accuracy_last_month,
      -- Hace 3 meses
      CASE
        WHEN COUNT(CASE WHEN tq.created_at >= NOW() - INTERVAL '90 days' THEN 1 END) > 0 THEN
          ROUND(SUM(CASE WHEN tq.created_at >= NOW() - INTERVAL '90 days' AND tq.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100 /
                COUNT(CASE WHEN tq.created_at >= NOW() - INTERVAL '90 days' THEN 1 END)::NUMERIC, 1)
        ELSE NULL
      END as accuracy_three_months_ago
    FROM test_questions tq
    INNER JOIN tests t ON t.id = tq.test_id
    WHERE t.user_id = p_user_id
  ),
  test_count AS (
    -- Contar tests completados (con is_completed = true)
    SELECT COUNT(*)::INTEGER as total_tests_completed
    FROM tests
    WHERE user_id = p_user_id
      AND is_completed = true
  )
  SELECT
    us.id as user_id,
    us.user_created_at,
    us.total_questions,
    us.correct_answers,
    us.global_accuracy,
    us.total_tests,
    calculate_user_streak(p_user_id) as current_streak, -- Usar la función de racha existente
    COALESCE(
      (SELECT MAX(streak_days) FROM user_streaks WHERE user_id = p_user_id),
      calculate_user_streak(p_user_id)
    ) as longest_streak,
    us.target_oposicion,
    COALESCE(tm.mastered_count, 0) as mastered_topics, -- AHORA CALCULADO CORRECTAMENTE
    ap.accuracy_this_week,
    ap.accuracy_last_month,
    ap.accuracy_three_months_ago,
    ts.today_tests,
    ts.today_questions,
    ts.today_correct,
    tc.total_tests_completed
  FROM user_stats us
  CROSS JOIN today_stats ts
  CROSS JOIN accuracy_periods ap
  CROSS JOIN test_count tc
  LEFT JOIN topic_mastery tm ON true;
END;
$$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION get_user_public_stats(UUID) TO authenticated;

-- Agregar comentario descriptivo
COMMENT ON FUNCTION get_user_public_stats IS
  'Obtiene estadísticas públicas del usuario incluyendo temas dominados (>80% con mínimo 10 preguntas) y tests completados';

-- Verificación: Probar con un usuario que sabemos que tiene datos
-- (Reemplazar USER_ID_HERE con un ID real para probar)
/*
SELECT
  user_id,
  target_oposicion,
  mastered_topics,
  total_tests_completed,
  total_tests,
  global_accuracy
FROM get_user_public_stats('USER_ID_HERE');
*/