-- ============================================
-- Optimización de batch_update_user_streaks
-- ============================================
--
-- PROBLEMA: FOR LOOP con 853+ queries individuales causa timeout (código 57014)
--   - Cada iteración llama a calculate_user_streak()
--   - Que hace JOIN de 197k filas de test_questions
--   - Total: ~168 millones de operaciones → timeout en 8 segundos
--
-- SOLUCIÓN: Una sola query agregada usando técnica "gaps and islands"
--   - Procesa todos los usuarios en 2 queries
--   - Total: ~200k operaciones → <3 segundos
--
-- EJECUTAR: Copiar y ejecutar en Supabase SQL Editor
-- ============================================

CREATE OR REPLACE FUNCTION public.batch_update_user_streaks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today DATE;
  v_updated_active INTEGER := 0;
  v_updated_inactive INTEGER := 0;
BEGIN
  v_today := (NOW() AT TIME ZONE 'Europe/Madrid')::DATE;

  -- ===========================================
  -- PASO 1: Actualizar usuarios CON actividad reciente
  -- Técnica: gaps and islands para calcular rachas
  -- ===========================================

  WITH
  -- 1. Obtener días únicos de actividad por usuario (últimos 60 días)
  activity_days AS (
    SELECT DISTINCT
      t.user_id,
      (tq.created_at AT TIME ZONE 'Europe/Madrid')::DATE as day
    FROM test_questions tq
    JOIN tests t ON tq.test_id = t.id
    WHERE tq.created_at >= v_today - 60
  ),

  -- 2. Asignar número de grupo usando gaps and islands
  -- La diferencia (day - row_number) es constante para días consecutivos
  numbered AS (
    SELECT
      user_id,
      day,
      day - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day))::int AS grp
    FROM activity_days
  ),

  -- 3. Calcular rachas (tamaño de cada grupo consecutivo)
  streaks AS (
    SELECT
      user_id,
      MIN(day) as streak_start,
      MAX(day) as streak_end,
      COUNT(*) as streak_length
    FROM numbered
    GROUP BY user_id, grp
  ),

  -- 4. Seleccionar solo la racha más reciente si incluye hoy o ayer
  current_streaks AS (
    SELECT
      user_id,
      streak_end as last_activity,
      CASE
        WHEN streak_end >= v_today - 1 THEN streak_length::INTEGER
        ELSE 0
      END as current_streak
    FROM streaks
    WHERE streak_end = (
      SELECT MAX(s2.streak_end)
      FROM streaks s2
      WHERE s2.user_id = streaks.user_id
    )
  )

  -- 5. Actualizar user_streaks
  UPDATE user_streaks us
  SET
    current_streak = cs.current_streak,
    longest_streak = GREATEST(us.longest_streak, cs.current_streak),
    last_activity_date = cs.last_activity,
    streak_updated_at = NOW()
  FROM current_streaks cs
  WHERE us.user_id = cs.user_id
    AND us.streak_updated_at::DATE < v_today;

  GET DIAGNOSTICS v_updated_active = ROW_COUNT;

  -- ===========================================
  -- PASO 2: Resetear usuarios sin actividad reciente
  -- ===========================================

  UPDATE user_streaks
  SET
    current_streak = 0,
    streak_updated_at = NOW()
  WHERE current_streak > 0
    AND streak_updated_at::DATE < v_today
    AND (last_activity_date IS NULL OR last_activity_date < v_today - 1);

  GET DIAGNOSTICS v_updated_inactive = ROW_COUNT;

  RAISE NOTICE 'batch_update_user_streaks: % activos, % reseteados',
    v_updated_active, v_updated_inactive;
END;
$function$;

-- ============================================
-- ÍNDICE OPCIONAL (si no existe)
-- ============================================

-- Acelera el JOIN de test_questions con tests filtrado por fecha
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_tq_created_testid'
  ) THEN
    CREATE INDEX idx_tq_created_testid
    ON test_questions (created_at DESC, test_id);
  END IF;
END $$;

-- ============================================
-- COMENTARIO DE DOCUMENTACIÓN
-- ============================================

COMMENT ON FUNCTION batch_update_user_streaks IS
'v2.0 - Optimizada con técnica gaps and islands.
Antes: FOR LOOP con N queries (timeout con 800+ usuarios)
Ahora: 2 queries agregadas (<5 segundos)
Ejecutada diariamente por pg_cron.';
