-- =====================================================
-- FIX: calculate_user_streak + batch_update_user_streaks
--
-- PROBLEMA DETECTADO (2026-01-09):
-- La racha no se calcula correctamente con dia de gracia.
-- Ejemplo: usuario con actividad 06, 07, 09 enero tiene racha 2 en vez de 4.
--
-- LOGICA CORRECTA:
-- 1. Contar PREGUNTAS RESPONDIDAS (test_questions), NO tests completados
-- 2. Con 1 sola pregunta respondida cuenta como dia activo
-- 3. Dia de gracia: 1 dia sin actividad NO rompe la racha
-- 4. 2+ dias consecutivos sin actividad SI rompen la racha
-- 5. La racha cuenta dias totales (desde inicio hasta hoy, incluyendo dias de gracia)
--
-- EJECUTADO: 2026-01-09 - Corregido y funcionando
-- =====================================================

-- =====================================================
-- 1. FUNCION calculate_user_streak (llamada por trigger)
-- =====================================================
DROP FUNCTION IF EXISTS calculate_user_streak(UUID) CASCADE;

CREATE OR REPLACE FUNCTION calculate_user_streak(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE;
  v_check_date DATE;
  v_has_activity BOOLEAN;
  v_consecutive_misses INTEGER := 0;
  v_streak_days INTEGER := 0;
  v_found_activity BOOLEAN := FALSE;
BEGIN
  -- Fecha actual en timezone Madrid
  v_today := (NOW() AT TIME ZONE 'Europe/Madrid')::DATE;

  -- Recorrer hasta 365 dias hacia atras
  FOR i IN 0..365 LOOP
    v_check_date := v_today - i;

    -- Verificar si hay actividad ese dia (al menos 1 pregunta respondida)
    SELECT EXISTS(
      SELECT 1
      FROM test_questions tq
      JOIN tests t ON tq.test_id = t.id
      WHERE t.user_id = p_user_id
        AND (tq.created_at AT TIME ZONE 'Europe/Madrid')::DATE = v_check_date
      LIMIT 1
    ) INTO v_has_activity;

    IF v_has_activity THEN
      -- Dia con actividad
      v_found_activity := TRUE;
      v_streak_days := i + 1;  -- Dias desde hoy hasta este dia inclusive
      v_consecutive_misses := 0;
    ELSE
      -- Dia sin actividad
      v_consecutive_misses := v_consecutive_misses + 1;

      -- Si aun no encontramos actividad, seguir buscando (dias de gracia al inicio)
      IF NOT v_found_activity THEN
        CONTINUE;
      END IF;

      -- Si hay 2+ dias consecutivos sin actividad DESPUES de encontrar actividad, terminar
      IF v_consecutive_misses >= 2 THEN
        EXIT;
      END IF;
      -- 1 dia sin actividad es permitido (dia de gracia)
    END IF;
  END LOOP;

  -- Si nunca encontramos actividad, racha = 0
  IF NOT v_found_activity THEN
    RETURN 0;
  END IF;

  RETURN v_streak_days;
END;
$$;

-- =====================================================
-- 2. FUNCION update_user_streak_function (llamada por trigger)
-- =====================================================
DROP FUNCTION IF EXISTS update_user_streak_function() CASCADE;

CREATE OR REPLACE FUNCTION update_user_streak_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_new_streak INTEGER;
  v_today DATE;
BEGIN
  -- Obtener user_id del test
  SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  -- Calcular nueva racha
  v_new_streak := calculate_user_streak(v_user_id);
  v_today := (NOW() AT TIME ZONE 'Europe/Madrid')::DATE;

  -- Actualizar o insertar en user_streaks
  INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity_date, streak_updated_at)
  VALUES (v_user_id, v_new_streak, v_new_streak, v_today, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    current_streak = v_new_streak,
    longest_streak = GREATEST(user_streaks.longest_streak, v_new_streak),
    last_activity_date = v_today,
    streak_updated_at = NOW();

  RETURN NEW;
END;
$$;

-- =====================================================
-- 3. TRIGGER en test_questions
-- =====================================================
DROP TRIGGER IF EXISTS trigger_update_user_streak ON test_questions;

CREATE TRIGGER trigger_update_user_streak
  AFTER INSERT ON test_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_streak_function();

-- =====================================================
-- 4. FUNCION batch_update_user_streaks (para cron diario)
-- =====================================================
DROP FUNCTION IF EXISTS batch_update_user_streaks();

CREATE OR REPLACE FUNCTION batch_update_user_streaks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record RECORD;
  v_new_streak INTEGER;
  v_today DATE;
BEGIN
  v_today := (NOW() AT TIME ZONE 'Europe/Madrid')::DATE;

  FOR user_record IN SELECT user_id FROM user_streaks
  LOOP
    v_new_streak := calculate_user_streak(user_record.user_id);

    UPDATE user_streaks
    SET
      current_streak = v_new_streak,
      longest_streak = GREATEST(longest_streak, v_new_streak),
      streak_updated_at = NOW()
    WHERE user_id = user_record.user_id;
  END LOOP;
END;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION calculate_user_streak(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_user_streak(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION batch_update_user_streaks() TO service_role;

COMMENT ON FUNCTION calculate_user_streak IS
'Calcula la racha de un usuario basandose en preguntas respondidas.
1 pregunta = 1 dia activo. Dia de gracia: 1 dia sin actividad permitido.
2+ dias sin actividad rompen la racha.';

COMMENT ON FUNCTION batch_update_user_streaks IS
'Actualiza las rachas de todos los usuarios. Ejecutar via cron diario.';
