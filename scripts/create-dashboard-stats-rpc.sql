-- Función RPC para obtener estadísticas del dashboard sin límites
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE (
  total_users BIGINT,
  users_with_tests BIGINT,
  engagement_percentage INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH user_counts AS (
    -- Total de usuarios
    SELECT COUNT(DISTINCT user_id) as total
    FROM admin_users_with_roles
  ),
  test_users AS (
    -- Usuarios únicos que han completado al menos un test
    SELECT COUNT(DISTINCT t.user_id) as with_tests
    FROM tests t
    WHERE t.is_completed = true
      AND EXISTS (
        SELECT 1
        FROM admin_users_with_roles u
        WHERE u.user_id = t.user_id
      )
  )
  SELECT
    uc.total as total_users,
    tu.with_tests as users_with_tests,
    CASE
      WHEN uc.total > 0 THEN
        ROUND((tu.with_tests::NUMERIC / uc.total::NUMERIC) * 100)::INTEGER
      ELSE 0
    END as engagement_percentage
  FROM user_counts uc, test_users tu;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;

-- Test
SELECT * FROM get_dashboard_stats();