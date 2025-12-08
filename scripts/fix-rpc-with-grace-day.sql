-- Actualizar la RPC para calcular rachas correctamente con día de gracia

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
DECLARE
  v_current_streak INTEGER := 0;
  v_longest_streak INTEGER := 0;
  v_check_date DATE;
  v_has_activity BOOLEAN;
  v_consecutive_misses INTEGER := 0;
  v_streak_days INTEGER := 0;
  v_temp_streak INTEGER := 0;
BEGIN
  -- Calcular racha actual con día de gracia
  -- Permitir 1 día sin actividad antes de romper la racha
  FOR i IN 0..365 LOOP
    v_check_date := CURRENT_DATE - i;

    SELECT EXISTS(
      SELECT 1 FROM tests t
      WHERE t.user_id = p_user_id
        AND DATE(t.created_at) = v_check_date
        AND t.is_completed = true
    ) INTO v_has_activity;

    IF v_has_activity THEN
      v_streak_days := v_streak_days + 1;
      v_consecutive_misses := 0;
    ELSE
      v_consecutive_misses := v_consecutive_misses + 1;

      -- Si es el primer día (hoy) y no hay actividad, no contar como racha
      IF i = 0 THEN
        -- Continuar para ver si hubo actividad ayer
        CONTINUE;
      -- Si ayer tampoco hubo actividad, la racha es 0
      ELSIF i = 1 AND v_consecutive_misses = 2 THEN
        v_streak_days := 0;
        EXIT;
      -- Permitir 1 día de gracia
      ELSIF v_consecutive_misses = 1 THEN
        v_streak_days := v_streak_days + 1; -- Contar el día de gracia
        -- Continuar contando
      -- Si hay 2+ días sin actividad, romper racha
      ELSE
        EXIT;
      END IF;
    END IF;

    -- Si encontramos el inicio de la racha, salir
    IF i > 0 AND NOT v_has_activity AND v_consecutive_misses > 1 THEN
      EXIT;
    END IF;
  END LOOP;

  v_current_streak := v_streak_days;

  -- Por ahora usar la racha actual como la más larga
  -- (idealmente esto se calcularía históricamente)
  v_longest_streak := v_current_streak;

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
  week_questions AS (
    SELECT
      COUNT(tq.id)::INTEGER as questions_count
    FROM tests t
    LEFT JOIN test_questions tq ON tq.test_id = t.id
    WHERE t.user_id = p_user_id
      AND t.created_at >= CURRENT_DATE - INTERVAL '7 days'
  ),
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
  )
  SELECT
    ui.user_id_param as user_id,
    COALESCE(us.total_questions, 0)::BIGINT,
    COALESCE(us.correct_answers, 0)::BIGINT,
    COALESCE(us.global_accuracy, 0)::NUMERIC,
    COALESCE(us.total_tests, 0)::BIGINT,
    ui.user_created_at,
    us.last_activity_date,
    'auxiliar_administrativo_estado'::TEXT as target_oposicion,
    v_current_streak::INTEGER,
    v_longest_streak::INTEGER,
    COALESCE(ts.today_tests, 0)::INTEGER,
    COALESCE(ts.today_questions, 0)::INTEGER,
    COALESCE(ts.today_correct, 0)::INTEGER,
    COALESCE(wq.questions_count, 0)::INTEGER as questions_this_week,
    0::INTEGER as mastered_topics,
    ws.accuracy as accuracy_this_week,
    ms.accuracy as accuracy_last_month,
    tms.accuracy as accuracy_three_months_ago
  FROM user_info ui
  LEFT JOIN user_stats us ON us.user_id = p_user_id
  LEFT JOIN today_stats ts ON true
  LEFT JOIN week_questions wq ON true
  LEFT JOIN week_stats ws ON true
  LEFT JOIN month_stats ms ON true
  LEFT JOIN three_month_stats tms ON true;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Verificar que funciona
SELECT current_streak, longest_streak
FROM get_user_public_stats('c16c186a-4e70-4b1e-a3bd-c107e13670dd'::uuid);