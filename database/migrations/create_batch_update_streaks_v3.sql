-- ============================================================================
-- ESTRATEGIA SIMPLIFICADA: Solo actualizar last_activity_date en batch
-- El cálculo de racha se hace bajo demanda cuando se necesita
-- ============================================================================

CREATE OR REPLACE FUNCTION batch_update_user_streaks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo actualizar last_activity_date de forma masiva
  -- El cálculo de current_streak/longest_streak se hará bajo demanda

  INSERT INTO user_streaks (
    user_id,
    last_activity_date,
    current_streak,
    longest_streak,
    streak_updated_at
  )
  SELECT
    t.user_id,
    MAX(DATE(tq.created_at)) as last_activity_date,
    0 as current_streak,  -- Se calculará bajo demanda
    0 as longest_streak,  -- Se calculará bajo demanda
    NOW() as streak_updated_at
  FROM test_questions tq
  INNER JOIN tests t ON t.id = tq.test_id
  GROUP BY t.user_id

  ON CONFLICT (user_id) DO UPDATE SET
    last_activity_date = EXCLUDED.last_activity_date,
    streak_updated_at = NOW();

  RAISE NOTICE '✅ Last activity dates actualizados para todos los usuarios';
END;
$$;

GRANT EXECUTE ON FUNCTION batch_update_user_streaks TO authenticated;
GRANT EXECUTE ON FUNCTION batch_update_user_streaks TO service_role;

COMMENT ON FUNCTION batch_update_user_streaks IS 'Actualiza last_activity_date - las rachas se calculan bajo demanda';
