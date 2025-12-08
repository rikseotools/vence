-- Script para crear RPC get_admin_dashboard_stats
-- Este RPC calcula estadísticas generales del admin dashboard de forma eficiente

CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS TABLE (
  total_users BIGINT,
  users_with_tests BIGINT,
  engagement_percentage NUMERIC
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH user_stats AS (
    -- Total de usuarios registrados
    SELECT COUNT(DISTINCT id) as total_users
    FROM user_profiles
  ),
  users_with_tests_stats AS (
    -- Usuarios que han completado al menos un test
    SELECT COUNT(DISTINCT user_id) as users_with_tests
    FROM tests
    WHERE is_completed = true
  )
  SELECT
    us.total_users,
    uwt.users_with_tests,
    -- Calcular porcentaje de engagement (usuarios con tests / total usuarios)
    CASE
      WHEN us.total_users > 0 THEN
        ROUND((uwt.users_with_tests::NUMERIC / us.total_users::NUMERIC) * 100, 1)
      ELSE 0
    END as engagement_percentage
  FROM user_stats us
  CROSS JOIN users_with_tests_stats uwt;
END;
$$;

-- Dar permisos de ejecución
GRANT EXECUTE ON FUNCTION get_admin_dashboard_stats() TO authenticated;

-- Comentario de la función
COMMENT ON FUNCTION get_admin_dashboard_stats() IS 'Devuelve estadísticas generales para el admin dashboard: total usuarios, usuarios con tests y porcentaje de engagement';
