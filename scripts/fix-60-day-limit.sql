-- FIX: Eliminar límite de 60 días en rachas
-- El problema está en la función calculate_user_streak que solo revisa 60 días

-- Primero, actualizar la función para revisar hasta 365 días
CREATE OR REPLACE FUNCTION calculate_user_streak(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_streak INTEGER := 0;
  v_check_date DATE;
  v_has_activity BOOLEAN;
  v_consecutive_misses INTEGER := 0;
  v_days_in_streak INTEGER := 0;
BEGIN
  -- Obtener fecha de hoy
  v_check_date := CURRENT_DATE;

  -- CAMBIO: Revisar últimos 365 días en lugar de 60
  FOR i IN 0..365 LOOP
    v_check_date := CURRENT_DATE - i;

    -- Verificar si hay actividad en esta fecha
    SELECT EXISTS(
      SELECT 1
      FROM test_questions tq
      JOIN tests t ON tq.test_id = t.id
      WHERE t.user_id = p_user_id
        AND DATE(tq.created_at) = v_check_date
    ) INTO v_has_activity;

    IF v_has_activity THEN
      v_streak := v_streak + 1;
      v_days_in_streak := v_days_in_streak + 1;
      v_consecutive_misses := 0;
    ELSE
      v_consecutive_misses := v_consecutive_misses + 1;

      -- Si hemos encontrado al menos un día con actividad
      IF v_streak > 0 THEN
        v_days_in_streak := v_days_in_streak + 1;

        -- Si faltan 2+ días seguidos (día de gracia), romper racha
        IF v_consecutive_misses >= 2 THEN
          v_days_in_streak := v_days_in_streak - 1;
          EXIT;
        END IF;
      END IF;
    END IF;

    -- Si no hemos encontrado actividad y llevamos muchos días, salir
    IF v_streak = 0 AND i > 7 THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN v_days_in_streak;
END;
$$ LANGUAGE plpgsql STABLE;

-- Ahora, recalcular todas las rachas para corregir los valores actuales
DO $$
DECLARE
  v_user RECORD;
  v_new_streak INTEGER;
  v_count INTEGER := 0;
BEGIN
  -- Para cada usuario con racha
  FOR v_user IN
    SELECT DISTINCT user_id, current_streak, last_activity_date
    FROM user_streaks
    ORDER BY current_streak DESC
  LOOP
    -- Recalcular su racha real
    v_new_streak := calculate_user_streak(v_user.user_id);

    -- Si la nueva racha es diferente, actualizar
    IF v_new_streak != v_user.current_streak THEN
      UPDATE user_streaks
      SET
        current_streak = v_new_streak,
        longest_streak = GREATEST(longest_streak, v_new_streak),
        streak_updated_at = NOW()
      WHERE user_id = v_user.user_id;

      v_count := v_count + 1;

      -- Mostrar cambios importantes
      IF v_user.current_streak = 60 AND v_new_streak > 60 THEN
        RAISE NOTICE 'Usuario % actualizado de 60 a % días',
          LEFT(v_user.user_id::text, 8), v_new_streak;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Rachas actualizadas: %', v_count;
END;
$$;

-- Verificar resultados
SELECT
  u.display_name,
  s.current_streak,
  s.longest_streak,
  s.last_activity_date
FROM user_streaks s
LEFT JOIN public_user_profiles u ON s.user_id = u.id
WHERE s.current_streak >= 60
ORDER BY s.current_streak DESC;

-- Verificar específicamente a Nila
SELECT
  'Nila' as usuario,
  s.current_streak as racha_actual,
  s.longest_streak as racha_maxima,
  s.last_activity_date as ultima_actividad,
  calculate_user_streak(s.user_id) as racha_recalculada
FROM user_streaks s
JOIN public_user_profiles u ON s.user_id = u.id
WHERE u.display_name = 'Nila';