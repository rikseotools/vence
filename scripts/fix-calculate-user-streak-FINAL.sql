-- ============================================
-- FIX DEFINITIVO: calculate_user_streak()
-- ============================================
-- PROBLEMA: La función calcula rachas sin validar contra user_profiles.created_at
-- SOLUCIÓN: Agregar validación para limitar racha a días en plataforma

CREATE OR REPLACE FUNCTION public.calculate_user_streak(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $function$
  DECLARE
    v_streak INTEGER := 0;
    v_check_date DATE;
    v_has_activity BOOLEAN;
    v_consecutive_misses INTEGER := 0;
    v_days_in_streak INTEGER := 0;
    v_user_created_at TIMESTAMPTZ;
    v_max_possible_days INTEGER;
  BEGIN
    -- 🆕 OBTENER FECHA DE CREACIÓN DEL USUARIO
    SELECT created_at INTO v_user_created_at
    FROM user_profiles
    WHERE id = p_user_id;

    -- Si no existe el usuario, retornar 0
    IF v_user_created_at IS NULL THEN
      RETURN 0;
    END IF;

    -- 🆕 CALCULAR MÁXIMO DE DÍAS POSIBLES
    -- +1 porque si se creó hoy cuenta como 1 día
    v_max_possible_days := DATE_PART('day', CURRENT_DATE - DATE(v_user_created_at))::INTEGER + 1;

    -- Revisar últimos 365 días (o menos si el usuario es nuevo)
    FOR i IN 0..LEAST(365, v_max_possible_days) LOOP
      v_check_date := CURRENT_DATE - i;

      -- 🆕 NO REVISAR FECHAS ANTERIORES A LA CREACIÓN DEL USUARIO
      IF v_check_date < DATE(v_user_created_at) THEN
        EXIT;
      END IF;

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
        IF v_streak > 0 THEN
          v_days_in_streak := v_days_in_streak + 1;
          IF v_consecutive_misses >= 2 THEN
            v_days_in_streak := v_days_in_streak - 1;
            EXIT;
          END IF;
        END IF;
      END IF;

      IF v_streak = 0 AND i > 7 THEN
        EXIT;
      END IF;
    END LOOP;

    -- 🆕 VALIDACIÓN FINAL: Asegurar que la racha no exceda días en plataforma
    v_days_in_streak := LEAST(v_days_in_streak, v_max_possible_days);

    RETURN v_days_in_streak;
  END;
$function$;

-- ============================================
-- VERIFICACIÓN: Probar con usuarios problemáticos
-- ============================================

-- 1. Verificar Inma Corcuera (debería ser 1, no 9)
DO $$
DECLARE
  v_inma_id UUID := '7194d681-0047-47da-8d2f-45634b2605a1';
  v_new_streak INTEGER;
  v_days_in_platform INTEGER;
BEGIN
  -- Calcular días en plataforma
  SELECT DATE_PART('day', CURRENT_DATE - DATE(created_at))::INTEGER + 1
  INTO v_days_in_platform
  FROM user_profiles
  WHERE id = v_inma_id;

  -- Calcular nueva racha
  v_new_streak := calculate_user_streak(v_inma_id);

  RAISE NOTICE '📊 Inma Corcuera:';
  RAISE NOTICE '   Días en plataforma: %', v_days_in_platform;
  RAISE NOTICE '   Nueva racha calculada: %', v_new_streak;

  IF v_new_streak <= v_days_in_platform THEN
    RAISE NOTICE '   ✅ Racha válida';
  ELSE
    RAISE NOTICE '   ❌ ERROR: Racha > días en plataforma';
  END IF;
END $$;

-- 2. Actualizar TODOS los usuarios con rachas inválidas
UPDATE user_streaks
SET
  current_streak = calculate_user_streak(user_id),
  longest_streak = GREATEST(longest_streak, calculate_user_streak(user_id)),
  streak_updated_at = NOW()
WHERE user_id IN (
  SELECT us.user_id
  FROM user_streaks us
  JOIN user_profiles up ON us.user_id = up.id
  WHERE us.current_streak > DATE_PART('day', CURRENT_DATE - DATE(up.created_at))::INTEGER + 1
     OR us.longest_streak > DATE_PART('day', CURRENT_DATE - DATE(up.created_at))::INTEGER + 1
);

-- 3. Verificar que no quedan rachas inválidas
SELECT
  up.full_name,
  DATE_PART('day', CURRENT_DATE - DATE(up.created_at))::INTEGER + 1 as dias_en_plataforma,
  us.current_streak,
  us.longest_streak,
  CASE
    WHEN us.current_streak > DATE_PART('day', CURRENT_DATE - DATE(up.created_at))::INTEGER + 1
      THEN '❌ current_streak inválida'
    WHEN us.longest_streak > DATE_PART('day', CURRENT_DATE - DATE(up.created_at))::INTEGER + 1
      THEN '❌ longest_streak inválida'
    ELSE '✅ Válida'
  END as estado
FROM user_streaks us
JOIN user_profiles up ON us.user_id = up.id
WHERE us.current_streak > DATE_PART('day', CURRENT_DATE - DATE(up.created_at))::INTEGER + 1
   OR us.longest_streak > DATE_PART('day', CURRENT_DATE - DATE(up.created_at))::INTEGER + 1;

-- Si no devuelve ningún resultado = ✅ TODO CORREGIDO
