-- SCRIPT PARA ARREGLAR Y ACTUALIZAR user_learning_analytics

-- 1. Primero, limpiar registros duplicados (mantener el más reciente)
DELETE FROM user_learning_analytics
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM user_learning_analytics
  ORDER BY user_id, updated_at DESC
);

-- 2. Actualizar los datos existentes con valores correctos
UPDATE user_learning_analytics ula
SET
  total_tests_completed = (
    SELECT COUNT(*)
    FROM tests
    WHERE user_id = ula.user_id
      AND is_completed = true
  ),
  total_questions_answered = (
    SELECT COUNT(*)
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    WHERE t.user_id = ula.user_id
  ),
  overall_accuracy = (
    SELECT
      CASE
        WHEN COUNT(*) > 0 THEN
          ROUND(SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::NUMERIC * 100 / COUNT(*)::NUMERIC, 2)
        ELSE 0
      END
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    WHERE t.user_id = ula.user_id
  ),
  current_streak_days = COALESCE((
    SELECT current_streak
    FROM user_streaks
    WHERE user_id = ula.user_id
  ), 0),
  longest_streak_days = COALESCE((
    SELECT longest_streak
    FROM user_streaks
    WHERE user_id = ula.user_id
  ), 0),
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM tests WHERE user_id = ula.user_id
);

-- 3. Insertar registros para usuarios que no tienen entrada en user_learning_analytics
INSERT INTO user_learning_analytics (
  user_id,
  total_tests_completed,
  total_questions_answered,
  overall_accuracy,
  current_streak_days,
  longest_streak_days,
  mastery_level,
  created_at,
  updated_at
)
SELECT
  u.id as user_id,
  COUNT(DISTINCT CASE WHEN t.is_completed = true THEN t.id END) as total_tests_completed,
  COUNT(DISTINCT tq.id) as total_questions_answered,
  CASE
    WHEN COUNT(tq.id) > 0 THEN
      ROUND(SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100 / COUNT(tq.id)::NUMERIC, 2)
    ELSE 0
  END as overall_accuracy,
  COALESCE(us.current_streak, 0) as current_streak_days,
  COALESCE(us.longest_streak, 0) as longest_streak_days,
  CASE
    WHEN COUNT(tq.id) = 0 THEN 'beginner'
    WHEN ROUND(SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100 / COUNT(tq.id)::NUMERIC, 2) >= 90 THEN 'expert'
    WHEN ROUND(SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100 / COUNT(tq.id)::NUMERIC, 2) >= 80 THEN 'advanced'
    WHEN ROUND(SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100 / COUNT(tq.id)::NUMERIC, 2) >= 70 THEN 'intermediate'
    ELSE 'beginner'
  END as mastery_level,
  NOW() as created_at,
  NOW() as updated_at
FROM user_profiles u
LEFT JOIN tests t ON t.user_id = u.id
LEFT JOIN test_questions tq ON tq.test_id = t.id
LEFT JOIN user_streaks us ON us.user_id = u.id
WHERE EXISTS (
  SELECT 1 FROM tests WHERE user_id = u.id
)
AND NOT EXISTS (
  SELECT 1 FROM user_learning_analytics WHERE user_id = u.id
)
GROUP BY u.id, us.current_streak, us.longest_streak;

-- 4. Verificar el resultado para el usuario EM de Palencia
SELECT
  ula.user_id,
  up.email,
  pup.display_name,
  pup.ciudad,
  ula.total_tests_completed,
  ula.total_questions_answered,
  ula.overall_accuracy,
  ula.current_streak_days,
  ula.longest_streak_days,
  ula.mastery_level,
  ula.updated_at
FROM user_learning_analytics ula
JOIN user_profiles up ON up.id = ula.user_id
LEFT JOIN public_user_profiles pup ON pup.id = ula.user_id
WHERE pup.ciudad = 'Palencia'
  AND pup.display_name = 'EM';

-- 5. Crear función para actualizar automáticamente user_learning_analytics
CREATE OR REPLACE FUNCTION update_user_learning_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar o insertar estadísticas del usuario
  INSERT INTO user_learning_analytics (
    user_id,
    total_tests_completed,
    total_questions_answered,
    overall_accuracy,
    current_streak_days,
    longest_streak_days,
    updated_at
  )
  VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    (SELECT COUNT(*) FROM tests WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) AND is_completed = true),
    (SELECT COUNT(*) FROM test_questions tq JOIN tests t ON t.id = tq.test_id WHERE t.user_id = COALESCE(NEW.user_id, OLD.user_id)),
    (SELECT CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::NUMERIC * 100 / COUNT(*)::NUMERIC, 2) ELSE 0 END
     FROM test_questions tq JOIN tests t ON t.id = tq.test_id WHERE t.user_id = COALESCE(NEW.user_id, OLD.user_id)),
    (SELECT COALESCE(current_streak, 0) FROM user_streaks WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)),
    (SELECT COALESCE(longest_streak, 0) FROM user_streaks WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_tests_completed = EXCLUDED.total_tests_completed,
    total_questions_answered = EXCLUDED.total_questions_answered,
    overall_accuracy = EXCLUDED.overall_accuracy,
    current_streak_days = EXCLUDED.current_streak_days,
    longest_streak_days = EXCLUDED.longest_streak_days,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Crear trigger para actualizar automáticamente cuando se completa un test
DROP TRIGGER IF EXISTS update_analytics_on_test_complete ON tests;
CREATE TRIGGER update_analytics_on_test_complete
AFTER UPDATE OF is_completed ON tests
FOR EACH ROW
WHEN (NEW.is_completed = true)
EXECUTE FUNCTION update_user_learning_analytics();