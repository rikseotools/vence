-- Script para revisar y corregir el cálculo de rachas
-- El problema: usuarios con 1 día en Vence tienen rachas de 3+ días

-- 1. Verificar usuarios con rachas inconsistentes
SELECT
  up.id,
  up.email,
  up.created_at,
  DATE_PART('day', NOW() - up.created_at) as days_in_vence,
  -- Calcular racha actual correctamente
  (
    SELECT COUNT(DISTINCT DATE(completed_at))
    FROM tests t
    WHERE t.user_id = up.id
      AND t.is_completed = true
      AND DATE(completed_at) >= DATE(NOW()) - INTERVAL '30 days'
  ) as test_days_last_30,
  -- Ver racha máxima posible
  LEAST(
    DATE_PART('day', NOW() - up.created_at)::INTEGER + 1,
    (
      SELECT COUNT(DISTINCT DATE(completed_at))
      FROM tests t2
      WHERE t2.user_id = up.id
        AND t2.is_completed = true
    )
  ) as max_possible_streak
FROM user_profiles up
WHERE up.created_at > NOW() - INTERVAL '7 days' -- Usuarios nuevos
ORDER BY up.created_at DESC
LIMIT 20;

-- 2. Función mejorada para calcular racha actual
-- NOTA: Solo ejecutar después de verificar con la consulta anterior
CREATE OR REPLACE FUNCTION calculate_user_streak(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_streak INTEGER := 0;
  v_last_date DATE;
  v_current_date DATE := CURRENT_DATE;
  v_user_created_at DATE;
BEGIN
  -- Obtener fecha de creación del usuario
  SELECT DATE(created_at) INTO v_user_created_at
  FROM user_profiles
  WHERE id = p_user_id;

  -- Si el usuario no existe o es muy nuevo
  IF v_user_created_at IS NULL THEN
    RETURN 0;
  END IF;

  -- Buscar tests completados ordenados por fecha descendente
  FOR v_last_date IN
    SELECT DISTINCT DATE(completed_at) as test_date
    FROM tests
    WHERE user_id = p_user_id
      AND is_completed = true
      AND DATE(completed_at) <= v_current_date
    ORDER BY test_date DESC
  LOOP
    -- Si es el primer día o es consecutivo
    IF v_streak = 0 AND v_last_date = v_current_date THEN
      v_streak := 1;
      v_current_date := v_current_date - 1;
    ELSIF v_last_date = v_current_date THEN
      v_streak := v_streak + 1;
      v_current_date := v_current_date - 1;
    ELSE
      -- La racha se rompió
      EXIT;
    END IF;
  END LOOP;

  -- Validación importante: la racha no puede ser mayor que los días en Vence
  v_streak := LEAST(v_streak, DATE_PART('day', NOW() - v_user_created_at)::INTEGER + 1);

  RETURN v_streak;
END;
$$;

-- 3. Actualizar la función get_user_public_stats para usar el cálculo correcto
-- NOTA: Esta función ya debe existir, solo actualizamos la parte de current_streak
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
      COALESCE(COUNT(DISTINCT da.id), 0)::INTEGER as total_questions,
      COALESCE(SUM(CASE WHEN da.is_correct THEN 1 ELSE 0 END), 0)::INTEGER as correct_answers,
      CASE
        WHEN COUNT(da.id) > 0 THEN
          ROUND(SUM(CASE WHEN da.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100 / COUNT(da.id)::NUMERIC, 1)
        ELSE 0
      END as global_accuracy,
      COALESCE(COUNT(DISTINCT da.test_session_id), 0)::INTEGER as total_tests,
      up.target_oposicion
    FROM user_profiles up
    LEFT JOIN detailed_answers da ON da.user_id = up.id
    WHERE up.id = p_user_id
    GROUP BY up.id, up.created_at, up.target_oposicion
  ),
  today_stats AS (
    SELECT
      COUNT(DISTINCT t.id)::INTEGER as today_tests,
      COUNT(DISTINCT da.id)::INTEGER as today_questions,
      SUM(CASE WHEN da.is_correct THEN 1 ELSE 0 END)::INTEGER as today_correct
    FROM tests t
    LEFT JOIN detailed_answers da ON da.test_session_id = t.id
    WHERE t.user_id = p_user_id
      AND DATE(t.created_at) = CURRENT_DATE
  ),
  accuracy_periods AS (
    SELECT
      -- Esta semana
      CASE
        WHEN COUNT(CASE WHEN da.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) > 0 THEN
          ROUND(SUM(CASE WHEN da.created_at >= NOW() - INTERVAL '7 days' AND da.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100 /
                COUNT(CASE WHEN da.created_at >= NOW() - INTERVAL '7 days' THEN 1 END)::NUMERIC, 1)
        ELSE NULL
      END as accuracy_this_week,
      -- Último mes
      CASE
        WHEN COUNT(CASE WHEN da.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) > 0 THEN
          ROUND(SUM(CASE WHEN da.created_at >= NOW() - INTERVAL '30 days' AND da.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100 /
                COUNT(CASE WHEN da.created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::NUMERIC, 1)
        ELSE NULL
      END as accuracy_last_month,
      -- Hace 3 meses
      CASE
        WHEN COUNT(CASE WHEN da.created_at >= NOW() - INTERVAL '90 days' THEN 1 END) > 0 THEN
          ROUND(SUM(CASE WHEN da.created_at >= NOW() - INTERVAL '90 days' AND da.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100 /
                COUNT(CASE WHEN da.created_at >= NOW() - INTERVAL '90 days' THEN 1 END)::NUMERIC, 1)
        ELSE NULL
      END as accuracy_three_months_ago
    FROM detailed_answers da
    WHERE da.user_id = p_user_id
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
    calculate_user_streak(p_user_id) as current_streak, -- Usar la función mejorada
    COALESCE(
      (SELECT MAX(streak_days) FROM user_streaks WHERE user_id = p_user_id),
      calculate_user_streak(p_user_id)
    ) as longest_streak,
    us.target_oposicion,
    0 as mastered_topics, -- Simplificado
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
  CROSS JOIN test_count tc;
END;
$$;

-- 4. Otorgar permisos
GRANT EXECUTE ON FUNCTION calculate_user_streak(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_public_stats(UUID) TO authenticated;