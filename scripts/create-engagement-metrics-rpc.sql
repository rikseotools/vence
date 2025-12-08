-- Función RPC para obtener métricas de engagement sin límites RLS
-- Esta función calcula DAU, MAU y otras métricas importantes

CREATE OR REPLACE FUNCTION get_engagement_metrics()
RETURNS TABLE (
  total_users BIGINT,
  mau BIGINT,
  dau NUMERIC,
  last_7_days_tests BIGINT,
  last_30_days_tests BIGINT,
  total_tests BIGINT,
  activation_rate INTEGER,
  dau_mau_ratio INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_users BIGINT;
  v_mau BIGINT;
  v_dau NUMERIC;
  v_last_7_days_tests BIGINT;
  v_last_30_days_tests BIGINT;
  v_total_tests BIGINT;
BEGIN
  -- Total de usuarios registrados
  SELECT COUNT(*)::BIGINT INTO v_total_users
  FROM user_profiles;

  -- Total de tests completados
  SELECT COUNT(*)::BIGINT INTO v_total_tests
  FROM tests
  WHERE is_completed = true
    AND completed_at IS NOT NULL;

  -- Tests en los últimos 7 días
  SELECT COUNT(*)::BIGINT INTO v_last_7_days_tests
  FROM tests
  WHERE is_completed = true
    AND completed_at IS NOT NULL
    AND completed_at >= NOW() - INTERVAL '7 days';

  -- Tests en los últimos 30 días
  SELECT COUNT(*)::BIGINT INTO v_last_30_days_tests
  FROM tests
  WHERE is_completed = true
    AND completed_at IS NOT NULL
    AND completed_at >= NOW() - INTERVAL '30 days';

  -- MAU: Usuarios activos únicos en los últimos 30 días
  SELECT COUNT(DISTINCT user_id)::BIGINT INTO v_mau
  FROM tests
  WHERE is_completed = true
    AND completed_at IS NOT NULL
    AND completed_at >= NOW() - INTERVAL '30 days';

  -- DAU promedio: Promedio de usuarios activos diarios en los últimos 7 días
  WITH daily_active AS (
    SELECT
      DATE(completed_at) as day,
      COUNT(DISTINCT user_id) as daily_users
    FROM tests
    WHERE is_completed = true
      AND completed_at IS NOT NULL
      AND completed_at >= NOW() - INTERVAL '7 days'
    GROUP BY DATE(completed_at)
  )
  SELECT COALESCE(AVG(daily_users), 0) INTO v_dau
  FROM daily_active;

  -- Retornar resultados
  RETURN QUERY
  SELECT
    v_total_users as total_users,
    v_mau as mau,
    ROUND(v_dau) as dau,
    v_last_7_days_tests as last_7_days_tests,
    v_last_30_days_tests as last_30_days_tests,
    v_total_tests as total_tests,
    CASE
      WHEN v_total_users > 0 THEN
        ROUND((v_mau::NUMERIC / v_total_users::NUMERIC) * 100)::INTEGER
      ELSE 0
    END as activation_rate,
    CASE
      WHEN v_mau > 0 THEN
        ROUND((v_dau / v_mau::NUMERIC) * 100)::INTEGER
      ELSE 0
    END as dau_mau_ratio;
END;
$$;

-- Función adicional para obtener tests recientes con más detalle
CREATE OR REPLACE FUNCTION get_recent_tests_data(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  user_id UUID,
  completed_at TIMESTAMP WITH TIME ZONE,
  test_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.user_id,
    t.completed_at,
    DATE(t.completed_at) as test_date
  FROM tests t
  WHERE t.is_completed = true
    AND t.completed_at IS NOT NULL
    AND t.completed_at >= NOW() - (days_back || ' days')::INTERVAL
  ORDER BY t.completed_at DESC;
END;
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION get_engagement_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_tests_data(INTEGER) TO authenticated;