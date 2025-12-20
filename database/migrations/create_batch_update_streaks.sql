-- ============================================================================
-- FUNCIÓN BATCH: Actualizar rachas de todos los usuarios
-- Se ejecuta diariamente vía cron en lugar de trigger real-time
-- ============================================================================

CREATE OR REPLACE FUNCTION batch_update_user_streaks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_streak INTEGER;
BEGIN
  -- Iterar sobre cada usuario que tiene actividad
  FOR v_user IN
    SELECT DISTINCT t.user_id
    FROM tests t
    WHERE EXISTS (
      SELECT 1 FROM test_questions tq WHERE tq.test_id = t.id
    )
  LOOP
    -- Calcular racha usando la función existente
    SELECT calculate_user_streak(v_user.user_id) INTO v_streak;

    -- Actualizar o insertar en user_streaks
    INSERT INTO user_streaks (
      user_id,
      current_streak,
      longest_streak,
      last_activity_date,
      streak_updated_at
    )
    VALUES (
      v_user.user_id,
      v_streak,
      v_streak,
      CURRENT_DATE,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      current_streak = v_streak,
      longest_streak = GREATEST(user_streaks.longest_streak, v_streak),
      last_activity_date = CURRENT_DATE,
      streak_updated_at = NOW();
  END LOOP;

  RAISE NOTICE 'Rachas actualizadas para todos los usuarios';
END;
$$;

GRANT EXECUTE ON FUNCTION batch_update_user_streaks TO authenticated;
GRANT EXECUTE ON FUNCTION batch_update_user_streaks TO service_role;

COMMENT ON FUNCTION batch_update_user_streaks IS 'Actualiza rachas de todos los usuarios - se ejecuta diariamente vía cron';
