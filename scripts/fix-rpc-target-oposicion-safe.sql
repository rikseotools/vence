-- FIX SEGURO: Arreglar que target_oposicion no se pierda para usuarios sin detailed_answers
-- Problema: David e Inma muestran "Tests completados" en lugar de "Temas dominados"
-- Causa: La RPC no está devolviendo target_oposicion correctamente cuando no hay detailed_answers

-- La función actual hace LEFT JOIN con detailed_answers y si no hay registros,
-- el GROUP BY puede causar problemas con target_oposicion

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
  WITH user_base AS (
    -- PRIMERO: Obtener datos básicos del usuario SIN JOINS que puedan fallar
    SELECT
      up.id,
      up.created_at as user_created_at,
      up.target_oposicion
    FROM user_profiles up
    WHERE up.id = p_user_id
  ),
  user_stats AS (
    -- SEGUNDO: Obtener estadísticas (puede ser 0 si no hay datos)
    SELECT
      p_user_id as id,
      COALESCE(COUNT(DISTINCT da.id), 0)::INTEGER as total_questions,
      COALESCE(SUM(CASE WHEN da.is_correct THEN 1 ELSE 0 END), 0)::INTEGER as correct_answers,
      CASE
        WHEN COUNT(da.id) > 0 THEN
          ROUND(SUM(CASE WHEN da.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100 / COUNT(da.id)::NUMERIC, 1)
        ELSE 0
      END as global_accuracy,
      COALESCE(COUNT(DISTINCT da.test_session_id), 0)::INTEGER as total_tests
    FROM detailed_answers da
    WHERE da.user_id = p_user_id
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
    ub.id as user_id,
    ub.user_created_at,
    us.total_questions,
    us.correct_answers,
    us.global_accuracy,
    us.total_tests,
    calculate_user_streak(p_user_id) as current_streak,
    COALESCE(
      (SELECT MAX(streak_days) FROM user_streaks WHERE user_id = p_user_id),
      calculate_user_streak(p_user_id)
    ) as longest_streak,
    ub.target_oposicion,  -- AHORA VIENE DE user_base, NO SE PIERDE
    -- Calcular mastered_topics solo si es auxiliar_administrativo_estado
    CASE
      WHEN ub.target_oposicion = 'auxiliar_administrativo_estado' THEN
        CASE
          WHEN us.total_questions > 0 THEN 1  -- Temporal: al menos 1 si ha respondido preguntas
          ELSE 0
        END
      ELSE 0
    END as mastered_topics,
    ap.accuracy_this_week,
    ap.accuracy_last_month,
    ap.accuracy_three_months_ago,
    ts.today_tests,
    ts.today_questions,
    ts.today_correct,
    tc.total_tests_completed
  FROM user_base ub  -- USAR user_base como tabla principal
  CROSS JOIN user_stats us
  CROSS JOIN today_stats ts
  CROSS JOIN accuracy_periods ap
  CROSS JOIN test_count tc;
END;
$$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION get_user_public_stats(UUID) TO authenticated;

-- Comentario descriptivo
COMMENT ON FUNCTION get_user_public_stats IS
  'Obtiene estadísticas públicas del usuario. Corregido para mantener target_oposicion incluso sin detailed_answers';

-- TEST: Verificar que funciona para usuarios problemáticos
-- Buscar usuarios con auxiliar_administrativo_estado pero sin detailed_answers
/*
SELECT
  up.id,
  up.email,
  up.target_oposicion,
  (SELECT COUNT(*) FROM detailed_answers WHERE user_id = up.id) as answer_count,
  (SELECT target_oposicion FROM get_user_public_stats(up.id)) as rpc_oposicion
FROM user_profiles up
WHERE up.target_oposicion = 'auxiliar_administrativo_estado'
  AND NOT EXISTS (SELECT 1 FROM detailed_answers da WHERE da.user_id = up.id)
LIMIT 5;
*/