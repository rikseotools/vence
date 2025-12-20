-- ============================================================================
-- FUNCIÓN BATCH OPTIMIZADA: Actualizar rachas sin loops
-- Calcula rachas de TODOS los usuarios en una sola query SQL
-- ============================================================================

CREATE OR REPLACE FUNCTION batch_update_user_streaks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Actualizar rachas de todos los usuarios en una sola operación
  -- usando la lógica: actividad hoy o ayer = racha continúa, sino = racha rota

  WITH user_last_activity AS (
    -- Última fecha de actividad de cada usuario
    SELECT
      t.user_id,
      MAX(DATE(tq.created_at)) as last_activity_date
    FROM test_questions tq
    INNER JOIN tests t ON t.id = tq.test_id
    GROUP BY t.user_id
  ),
  user_streak_calculation AS (
    -- Calcular racha basada en continuidad
    SELECT
      user_id,
      last_activity_date,
      CASE
        -- Si la última actividad fue HOY, mantener/incrementar racha
        WHEN last_activity_date = CURRENT_DATE THEN 1
        -- Si fue AYER, la racha continúa (se actualizará en siguiente paso)
        WHEN last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN 1
        -- Si fue hace 2+ días, racha rota = 0
        ELSE 0
      END as is_active
    FROM user_last_activity
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
    usc.user_id,
    CASE
      WHEN usc.is_active = 1 THEN COALESCE(us.current_streak, 0) + 1
      ELSE 0
    END as current_streak,
    GREATEST(
      COALESCE(us.longest_streak, 0),
      CASE
        WHEN usc.is_active = 1 THEN COALESCE(us.current_streak, 0) + 1
        ELSE 0
      END
    ) as longest_streak,
    usc.last_activity_date,
    NOW()
  FROM user_streak_calculation usc
  LEFT JOIN user_streaks us ON us.user_id = usc.user_id

  ON CONFLICT (user_id) DO UPDATE SET
    current_streak = EXCLUDED.current_streak,
    longest_streak = GREATEST(user_streaks.longest_streak, EXCLUDED.longest_streak),
    last_activity_date = EXCLUDED.last_activity_date,
    streak_updated_at = NOW();

  RAISE NOTICE '✅ Rachas actualizadas para todos los usuarios en batch';
END;
$$;

GRANT EXECUTE ON FUNCTION batch_update_user_streaks TO authenticated;
GRANT EXECUTE ON FUNCTION batch_update_user_streaks TO service_role;

COMMENT ON FUNCTION batch_update_user_streaks IS 'Actualiza rachas de todos los usuarios - versión optimizada sin loops';
