-- VERSIÓN SEGURA: Fix límite de 60 días en rachas
-- Este script es SEGURO y reversible

-- ============================================
-- 1. PRIMERO: Ver qué cambiaría SIN modificar nada
-- ============================================

-- Crear función temporal para probar (no afecta la original)
CREATE OR REPLACE FUNCTION calculate_user_streak_test(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_streak INTEGER := 0;
  v_check_date DATE;
  v_has_activity BOOLEAN;
  v_consecutive_misses INTEGER := 0;
  v_days_in_streak INTEGER := 0;
BEGIN
  -- Revisar últimos 365 días en lugar de 60
  FOR i IN 0..365 LOOP
    v_check_date := CURRENT_DATE - i;

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

  RETURN v_days_in_streak;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 2. PREVIEW: Ver qué cambiaría antes de aplicar
-- ============================================
SELECT
  u.display_name,
  s.current_streak as racha_actual,
  calculate_user_streak_test(s.user_id) as racha_nueva,
  CASE
    WHEN s.current_streak = 60 AND calculate_user_streak_test(s.user_id) > 60 THEN
      '✅ SE CORREGIRÁ: estaba limitada a 60'
    WHEN s.current_streak != calculate_user_streak_test(s.user_id) THEN
      '⚠️ CAMBIO: diferencia detectada'
    ELSE
      '✔️ Sin cambios'
  END as estado,
  s.last_activity_date
FROM user_streaks s
LEFT JOIN public_user_profiles u ON s.user_id = u.id
WHERE s.current_streak >= 50  -- Solo ver rachas altas
   OR u.display_name IN ('Nila', 'Manuel', 'CARMEN')  -- Y usuarios específicos
ORDER BY s.current_streak DESC;

-- ============================================
-- 3. BACKUP: Guardar estado actual (por si acaso)
-- ============================================
CREATE TABLE IF NOT EXISTS user_streaks_backup_20241208 AS
SELECT *, NOW() as backup_date
FROM user_streaks;

-- ============================================
-- 4. APLICAR CAMBIOS (descomentar para ejecutar)
-- ============================================

-- PASO 1: Actualizar la función real (DESCOMENTAR para aplicar)
/*
CREATE OR REPLACE FUNCTION calculate_user_streak(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_streak INTEGER := 0;
  v_check_date DATE;
  v_has_activity BOOLEAN;
  v_consecutive_misses INTEGER := 0;
  v_days_in_streak INTEGER := 0;
BEGIN
  -- Revisar últimos 365 días en lugar de 60
  FOR i IN 0..365 LOOP
    v_check_date := CURRENT_DATE - i;

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

  RETURN v_days_in_streak;
END;
$$ LANGUAGE plpgsql STABLE;
*/

-- PASO 2: Actualizar rachas (DESCOMENTAR para aplicar)
/*
UPDATE user_streaks s
SET
  current_streak = calculate_user_streak(s.user_id),
  longest_streak = GREATEST(longest_streak, calculate_user_streak(s.user_id)),
  streak_updated_at = NOW()
WHERE s.current_streak = 60  -- Solo actualizar las que están en 60
  AND calculate_user_streak(s.user_id) > 60;  -- Y que deberían ser más
*/

-- ============================================
-- 5. VERIFICAR RESULTADOS
-- ============================================
SELECT
  'Después del cambio' as momento,
  u.display_name,
  s.current_streak,
  s.longest_streak,
  s.last_activity_date
FROM user_streaks s
LEFT JOIN public_user_profiles u ON s.user_id = u.id
WHERE s.current_streak >= 60
ORDER BY s.current_streak DESC;

-- ============================================
-- 6. EN CASO DE ERROR: Cómo revertir
-- ============================================
-- Si algo sale mal, ejecutar:
-- UPDATE user_streaks s
-- SET (current_streak, longest_streak, streak_updated_at) =
--     (b.current_streak, b.longest_streak, b.streak_updated_at)
-- FROM user_streaks_backup_20241208 b
-- WHERE s.user_id = b.user_id;

-- Limpiar función de test
DROP FUNCTION IF EXISTS calculate_user_streak_test(UUID);