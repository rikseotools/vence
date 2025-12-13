-- ============================================================================
-- LÓGICA INCREMENTAL: No recalcular 365 días, solo verificar continuidad
-- Muchísimo más rápido: O(1) en lugar de O(365)
-- ============================================================================

CREATE OR REPLACE FUNCTION batch_update_user_streaks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_processed INTEGER := 0;
BEGIN
  -- Actualizar rachas usando lógica incremental
  WITH user_activity AS (
    -- Obtener última actividad de cada usuario en los últimos 3 días
    SELECT
      t.user_id,
      MAX(DATE(tq.created_at)) as last_activity_date,
      COUNT(DISTINCT DATE(tq.created_at)) as active_days
    FROM test_questions tq
    INNER JOIN tests t ON t.id = tq.test_id
    WHERE tq.created_at >= CURRENT_DATE - INTERVAL '3 days'
    GROUP BY t.user_id
  ),
  streak_updates AS (
    SELECT
      ua.user_id,
      ua.last_activity_date,
      CASE
        -- Usuario activo HOY → incrementar racha
        WHEN ua.last_activity_date = CURRENT_DATE THEN
          COALESCE(us.current_streak, 0) + 1

        -- Usuario activo AYER → mantener racha (no incrementar porque ya se contó ayer)
        WHEN ua.last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN
          COALESCE(us.current_streak, 0)

        -- Usuario inactivo hace 2+ días → resetear racha
        ELSE 0
      END as new_streak
    FROM user_activity ua
    LEFT JOIN user_streaks us ON us.user_id = ua.user_id
  )

  -- Insertar o actualizar user_streaks
  INSERT INTO user_streaks (
    user_id,
    current_streak,
    longest_streak,
    last_activity_date,
    streak_updated_at
  )
  SELECT
    user_id,
    new_streak,
    GREATEST(new_streak, 0) as longest_streak,
    last_activity_date,
    NOW()
  FROM streak_updates

  ON CONFLICT (user_id) DO UPDATE SET
    current_streak = EXCLUDED.current_streak,
    longest_streak = GREATEST(user_streaks.longest_streak, EXCLUDED.longest_streak),
    last_activity_date = EXCLUDED.last_activity_date,
    streak_updated_at = NOW();

  GET DIAGNOSTICS v_processed = ROW_COUNT;

  RAISE NOTICE '✅ Rachas actualizadas para % usuarios (lógica incremental)', v_processed;
END;
$$;

GRANT EXECUTE ON FUNCTION batch_update_user_streaks TO authenticated;
GRANT EXECUTE ON FUNCTION batch_update_user_streaks TO service_role;

COMMENT ON FUNCTION batch_update_user_streaks IS 'Actualiza rachas con lógica incremental (O(1) por usuario) - se ejecuta diariamente a las 3 AM UTC';
