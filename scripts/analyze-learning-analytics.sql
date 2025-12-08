-- Análisis completo de user_learning_analytics

-- 1. Ver ejemplos de registros actuales
SELECT
  user_id,
  total_tests_completed,
  total_questions_answered,
  overall_accuracy,
  current_streak_days,
  longest_streak_days,
  mastery_level,
  updated_at,
  NOW() - updated_at as age
FROM user_learning_analytics
ORDER BY updated_at DESC
LIMIT 10;

-- 2. Ver cuándo fue la última actualización
SELECT
  MAX(updated_at) as last_update,
  NOW() - MAX(updated_at) as time_since_last_update,
  MIN(updated_at) as first_record,
  COUNT(DISTINCT user_id) as unique_users
FROM user_learning_analytics;

-- 3. Ver usuarios que SÍ tienen datos
SELECT
  ula.user_id,
  up.email,
  pup.display_name,
  ula.total_tests_completed,
  ula.total_questions_answered,
  ula.updated_at
FROM user_learning_analytics ula
JOIN user_profiles up ON up.id = ula.user_id
LEFT JOIN public_user_profiles pup ON pup.id = ula.user_id
ORDER BY ula.updated_at DESC
LIMIT 10;

-- 4. Buscar por qué EM no tiene registros
-- Ver si EM está en user_profiles
SELECT
  up.id,
  up.email,
  up.created_at,
  pup.display_name,
  pup.ciudad,
  (SELECT COUNT(*) FROM tests WHERE user_id = up.id) as total_tests,
  (SELECT COUNT(*) FROM test_questions tq JOIN tests t ON t.id = tq.test_id WHERE t.user_id = up.id) as total_questions,
  EXISTS(SELECT 1 FROM user_learning_analytics WHERE user_id = up.id) as has_analytics
FROM user_profiles up
LEFT JOIN public_user_profiles pup ON pup.id = up.id
WHERE pup.ciudad = 'Palencia'
  AND (pup.display_name = 'EM' OR pup.display_name LIKE '%EM%')
LIMIT 5;

-- 5. Ver qué porcentaje de usuarios activos tienen analytics
WITH active_users AS (
  SELECT DISTINCT user_id
  FROM tests
  WHERE created_at > NOW() - INTERVAL '30 days'
)
SELECT
  COUNT(DISTINCT au.user_id) as active_users_count,
  COUNT(DISTINCT ula.user_id) as users_with_analytics,
  ROUND(COUNT(DISTINCT ula.user_id)::NUMERIC * 100 / COUNT(DISTINCT au.user_id)::NUMERIC, 2) as percentage_with_analytics
FROM active_users au
LEFT JOIN user_learning_analytics ula ON ula.user_id = au.user_id;

-- 6. Ver si hay triggers o funciones que actualicen user_learning_analytics
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND (
    action_statement LIKE '%user_learning_analytics%'
    OR event_object_table = 'user_learning_analytics'
  );