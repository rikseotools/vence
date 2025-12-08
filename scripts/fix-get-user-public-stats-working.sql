-- FIX DEFINITIVO: get_user_public_stats con las tablas correctas
-- Usar test_questions en lugar de detailed_answers que NO existe

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
  WITH user_stats AS (
    SELECT
      up.id,
      up.created_at as user_created_at,
      COALESCE(COUNT(DISTINCT tq.id), 0)::INTEGER as total_questions,
      COALESCE(SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END), 0)::INTEGER as correct_answers,
      CASE
        WHEN COUNT(tq.id) > 0 THEN
          ROUND(SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100 / COUNT(tq.id)::NUMERIC, 1)
        ELSE 0
      END as global_accuracy,
      COALESCE(COUNT(DISTINCT tq.test_id), 0)::INTEGER as total_tests,
      up.target_oposicion
    FROM user_profiles up
    LEFT JOIN test_questions tq ON EXISTS (
      SELECT 1 FROM tests t
      WHERE t.id = tq.test_id
      AND t.user_id = up.id
    )
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
    WHERE EXISTS (
      SELECT 1 FROM tests t
      WHERE t.id = tq.test_id
      AND t.user_id = p_user_id
    )
  ),
  streak_data AS (
    SELECT
      COALESCE(user_streaks.current_streak, 0) as current_streak,
      COALESCE(user_streaks.longest_streak, 0) as longest_streak
    FROM user_streaks
    WHERE user_streaks.user_id = p_user_id
  ),
  test_count AS (
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
    COALESCE(sd.current_streak, 0) as current_streak,
    COALESCE(sd.longest_streak, 0) as longest_streak,
    us.target_oposicion,
    0 as mastered_topics, -- Simplificado por ahora
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
  LEFT JOIN streak_data sd ON true
  CROSS JOIN test_count tc;
END;
$$;

-- Verificar que la función se creó correctamente
SELECT * FROM get_user_public_stats(
  (SELECT id FROM user_profiles WHERE email = 'inmacorcuera72@gmail.com')
);