-- SOLUCIÓN SIMPLE: Solo agregar el campo total_tests_completed a la función existente
-- Mantener la estructura que ya funciona pero agregar el campo faltante

DROP FUNCTION IF EXISTS get_user_public_stats(UUID);

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
  SELECT
    p_user_id as user_id,
    up.created_at as user_created_at,
    COALESCE(COUNT(DISTINCT tq.id), 0)::INTEGER as total_questions,
    COALESCE(SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END), 0)::INTEGER as correct_answers,
    CASE
      WHEN COUNT(tq.id) > 0 THEN
        ROUND(SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100 / COUNT(tq.id)::NUMERIC, 1)
      ELSE 0
    END as global_accuracy,
    COALESCE(COUNT(DISTINCT t.id), 0)::INTEGER as total_tests,
    COALESCE(us.current_streak, 0)::INTEGER as current_streak,
    COALESCE(us.longest_streak, 0)::INTEGER as longest_streak,
    up.target_oposicion,
    -- FIX: Calcular temas dominados correctamente desde user_progress
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM user_progress uprg
      WHERE uprg.user_id = p_user_id
        AND uprg.accuracy_percentage >= 80
        AND uprg.total_attempts >= 10
    ), 0)::INTEGER as mastered_topics,
    NULL::NUMERIC as accuracy_this_week,
    NULL::NUMERIC as accuracy_last_month,
    NULL::NUMERIC as accuracy_three_months_ago,
    COUNT(DISTINCT CASE WHEN DATE(t.created_at) = CURRENT_DATE THEN t.id END)::INTEGER as today_tests,
    COUNT(DISTINCT CASE WHEN DATE(t.created_at) = CURRENT_DATE THEN tq.id END)::INTEGER as today_questions,
    SUM(CASE WHEN DATE(t.created_at) = CURRENT_DATE AND tq.is_correct THEN 1 ELSE 0 END)::INTEGER as today_correct,
    COUNT(DISTINCT CASE WHEN t.is_completed = true THEN t.id END)::INTEGER as total_tests_completed
  FROM user_profiles up
  LEFT JOIN tests t ON t.user_id = up.id
  LEFT JOIN test_questions tq ON tq.test_id = t.id
  LEFT JOIN user_streaks us ON us.user_id = up.id
  WHERE up.id = p_user_id
  GROUP BY up.id, up.created_at, up.target_oposicion, us.current_streak, us.longest_streak;
END;
$$;

-- Verificar con Inma
SELECT * FROM get_user_public_stats(
  (SELECT id FROM user_profiles WHERE email = 'inmacorcuera72@gmail.com')
);