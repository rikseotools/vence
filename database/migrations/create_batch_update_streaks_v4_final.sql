-- ============================================================================
-- OPTIMIZACIÓN FINAL: Solo procesar usuarios con actividad HOY
-- Reduce drásticamente el tiempo de ejecución
-- ============================================================================

CREATE OR REPLACE FUNCTION batch_update_user_streaks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_streak INTEGER;
  v_processed INTEGER := 0;
BEGIN
  -- Solo iterar sobre usuarios que tuvieron actividad HOY
  -- Esto reduce de ~todos los usuarios a solo los activos hoy (~50-200 usuarios)
  FOR v_user IN
    SELECT DISTINCT t.user_id
    FROM tests t
    INNER JOIN test_questions tq ON tq.test_id = t.id
    WHERE DATE(tq.created_at) = CURRENT_DATE
  LOOP
    -- Calcular racha usando la función existente (optimizada)
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

    v_processed := v_processed + 1;
  END LOOP;

  RAISE NOTICE '✅ Rachas actualizadas para % usuarios activos hoy', v_processed;
END;
$$;

GRANT EXECUTE ON FUNCTION batch_update_user_streaks TO authenticated;
GRANT EXECUTE ON FUNCTION batch_update_user_streaks TO service_role;

COMMENT ON FUNCTION batch_update_user_streaks IS 'Actualiza rachas solo para usuarios con actividad hoy - se ejecuta diariamente';
