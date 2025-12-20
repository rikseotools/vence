-- ============================================================================
-- OPTIMIZACIÓN FINAL: Procesar usuarios con actividad en últimos 2 días
-- Asegura capturar actividad independientemente de la hora de ejecución
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
  v_cutoff_date DATE;
BEGIN
  -- Calcular fecha de corte: hace 2 días
  -- Esto asegura que capturamos actividad reciente sin importar la hora
  v_cutoff_date := CURRENT_DATE - INTERVAL '2 days';

  -- Solo iterar sobre usuarios con actividad en los últimos 2 días
  -- Esto reduce de ~todos los usuarios a solo los activos recientemente (~100-300 usuarios)
  FOR v_user IN
    SELECT DISTINCT t.user_id
    FROM tests t
    INNER JOIN test_questions tq ON tq.test_id = t.id
    WHERE DATE(tq.created_at) >= v_cutoff_date
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

  RAISE NOTICE '✅ Rachas actualizadas para % usuarios activos en últimos 2 días', v_processed;
END;
$$;

GRANT EXECUTE ON FUNCTION batch_update_user_streaks TO authenticated;
GRANT EXECUTE ON FUNCTION batch_update_user_streaks TO service_role;

COMMENT ON FUNCTION batch_update_user_streaks IS 'Actualiza rachas para usuarios con actividad en últimos 2 días - se ejecuta diariamente a las 3 AM UTC';
