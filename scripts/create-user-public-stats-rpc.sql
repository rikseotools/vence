-- Función RPC para obtener estadísticas públicas de un usuario
-- Permite ver la información de cualquier usuario (perfiles públicos)

CREATE OR REPLACE FUNCTION get_user_public_stats(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  total_questions BIGINT,
  correct_answers BIGINT,
  global_accuracy NUMERIC,
  total_tests BIGINT,
  user_created_at TIMESTAMPTZ,
  last_activity_date DATE
) AS $$
BEGIN
  RETURN QUERY
  WITH user_stats AS (
    SELECT
      ts.user_id,
      COUNT(DISTINCT ts.id) as total_tests,
      SUM(ts.questions_answered) as total_questions,
      SUM(ts.correct_answers) as correct_answers,
      MAX(ts.created_at::DATE) as last_activity
    FROM test_sessions ts
    WHERE ts.user_id = p_user_id
    GROUP BY ts.user_id
  ),
  user_info AS (
    SELECT
      id,
      created_at
    FROM auth.users
    WHERE id = p_user_id
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
    us.last_activity as last_activity_date
  FROM user_info ui
  LEFT JOIN user_stats us ON ui.id = us.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos de ejecución
GRANT EXECUTE ON FUNCTION get_user_public_stats(UUID) TO authenticated;

-- Comentario descriptivo
COMMENT ON FUNCTION get_user_public_stats IS 'Obtiene estadísticas públicas de cualquier usuario para mostrar en su perfil';

-- ========================================
-- Test de la función
-- ========================================
-- SELECT * FROM get_user_public_stats('user-id-aqui');