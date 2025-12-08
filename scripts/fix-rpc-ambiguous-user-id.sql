-- Eliminar la función anterior con el problema de ambigüedad
DROP FUNCTION IF EXISTS get_user_public_stats(uuid);

-- Crear versión CORREGIDA sin ambigüedad en user_id
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
  questions_this_week INTEGER,
  mastered_topics INTEGER,
  accuracy_this_week NUMERIC,
  accuracy_last_month NUMERIC,
  accuracy_three_months_ago NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH user_stats AS (
    SELECT
      t.user_id,
      COUNT(DISTINCT t.id)::BIGINT as total_tests,
      COUNT(tq.id)::BIGINT as total_questions,
      COUNT(tq.id) FILTER (WHERE tq.is_correct = true)::BIGINT as correct_answers,
      CASE
        WHEN COUNT(tq.id) > 0 THEN
          ROUND((COUNT(tq.id) FILTER (WHERE tq.is_correct = true))::NUMERIC / COUNT(tq.id)::NUMERIC * 100, 1)
        ELSE 0
      END as global_accuracy,
      MAX(t.created_at)::DATE as last_activity_date
    FROM tests t
    LEFT JOIN test_questions tq ON tq.test_id = t.id
    WHERE t.user_id = p_user_id
      AND t.is_completed = true
    GROUP BY t.user_id
  ),
  user_info AS (
    SELECT
      p_user_id as user_id_param,
      au.created_at as user_created_at
    FROM auth.users au
    WHERE au.id = p_user_id
  ),
  today_stats AS (
    SELECT
      COUNT(DISTINCT t.id)::INTEGER as today_tests,
      COUNT(tq.id)::INTEGER as today_questions,
      COUNT(tq.id) FILTER (WHERE tq.is_correct = true)::INTEGER as today_correct
    FROM tests t
    LEFT JOIN test_questions tq ON tq.test_id = t.id
    WHERE t.user_id = p_user_id
      AND t.created_at >= CURRENT_DATE
      AND t.created_at < CURRENT_DATE + INTERVAL '1 day'
  ),
  -- Preguntas de esta semana (últimos 7 días)
  week_questions AS (
    SELECT
      COUNT(tq.id)::INTEGER as questions_count
    FROM tests t
    LEFT JOIN test_questions tq ON tq.test_id = t.id
    WHERE t.user_id = p_user_id
      AND t.created_at >= CURRENT_DATE - INTERVAL '7 days'
  ),
  -- Precisión de esta semana
  week_stats AS (
    SELECT
      CASE
        WHEN COUNT(tq.id) > 0 THEN
          ROUND((COUNT(tq.id) FILTER (WHERE tq.is_correct = true))::NUMERIC / COUNT(tq.id)::NUMERIC * 100, 1)
        ELSE NULL
      END as accuracy
    FROM tests t
    LEFT JOIN test_questions tq ON tq.test_id = t.id
    WHERE t.user_id = p_user_id
      AND t.created_at >= CURRENT_DATE - INTERVAL '7 days'
  ),
  -- Precisión del último mes
  month_stats AS (
    SELECT
      CASE
        WHEN COUNT(tq.id) > 0 THEN
          ROUND((COUNT(tq.id) FILTER (WHERE tq.is_correct = true))::NUMERIC / COUNT(tq.id)::NUMERIC * 100, 1)
        ELSE NULL
      END as accuracy
    FROM tests t
    LEFT JOIN test_questions tq ON tq.test_id = t.id
    WHERE t.user_id = p_user_id
      AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
  ),
  -- Precisión de hace 3 meses
  three_month_stats AS (
    SELECT
      CASE
        WHEN COUNT(tq.id) > 0 THEN
          ROUND((COUNT(tq.id) FILTER (WHERE tq.is_correct = true))::NUMERIC / COUNT(tq.id)::NUMERIC * 100, 1)
        ELSE NULL
      END as accuracy
    FROM tests t
    LEFT JOIN test_questions tq ON tq.test_id = t.id
    WHERE t.user_id = p_user_id
      AND t.created_at >= CURRENT_DATE - INTERVAL '90 days'
  ),
  -- Calcular racha actual (días consecutivos con actividad)
  streak_calc AS (
    SELECT
      COUNT(DISTINCT DATE(created_at))::INTEGER as current_streak
    FROM tests
    WHERE tests.user_id = p_user_id  -- Especificar tabla explícitamente
      AND created_at >= (
        -- Encontrar el inicio de la racha actual
        SELECT COALESCE(MAX(date_check) + INTERVAL '1 day', CURRENT_DATE - INTERVAL '365 days')
        FROM (
          SELECT date_check
          FROM generate_series(
            CURRENT_DATE - INTERVAL '90 days',
            CURRENT_DATE - INTERVAL '1 day',
            INTERVAL '1 day'
          ) as date_check
          WHERE NOT EXISTS (
            SELECT 1 FROM tests t2
            WHERE t2.user_id = p_user_id
            AND DATE(t2.created_at) = date_check
          )
        ) as missing_days
      )
  )
  SELECT
    ui.user_id_param as user_id,  -- Cambiado para evitar ambigüedad
    COALESCE(us.total_questions, 0)::BIGINT,
    COALESCE(us.correct_answers, 0)::BIGINT,
    COALESCE(us.global_accuracy, 0)::NUMERIC,
    COALESCE(us.total_tests, 0)::BIGINT,
    ui.user_created_at,
    us.last_activity_date,
    'auxiliar_administrativo_estado'::TEXT as target_oposicion,
    COALESCE(sc.current_streak, 0)::INTEGER,
    COALESCE(sc.current_streak, 0)::INTEGER as longest_streak,
    COALESCE(ts.today_tests, 0)::INTEGER,
    COALESCE(ts.today_questions, 0)::INTEGER,
    COALESCE(ts.today_correct, 0)::INTEGER,
    COALESCE(wq.questions_count, 0)::INTEGER as questions_this_week,
    0::INTEGER as mastered_topics,
    ws.accuracy as accuracy_this_week,
    ms.accuracy as accuracy_last_month,
    tms.accuracy as accuracy_three_months_ago
  FROM user_info ui
  LEFT JOIN user_stats us ON us.user_id = p_user_id  -- Especificar condición
  LEFT JOIN today_stats ts ON true
  LEFT JOIN week_questions wq ON true
  LEFT JOIN week_stats ws ON true
  LEFT JOIN month_stats ms ON true
  LEFT JOIN three_month_stats tms ON true
  LEFT JOIN streak_calc sc ON true;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Verificar que funciona
SELECT * FROM get_user_public_stats('2fc60bc8-1f9a-42c8-9c60-845c00af4a1f'::uuid);