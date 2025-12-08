-- Investigar completamente las estadísticas del usuario EM

-- 1. Encontrar el ID del usuario EM
WITH em_user AS (
  SELECT
    up.id,
    up.email,
    up.created_at,
    pup.display_name,
    pup.ciudad
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE pup.ciudad = 'Palencia'
    AND (pup.display_name = 'EM' OR pup.display_name LIKE 'EM%')
  LIMIT 1
)
SELECT * FROM em_user;

-- 2. Ver qué hay en user_learning_analytics para EM
WITH em_user AS (
  SELECT up.id
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE pup.ciudad = 'Palencia'
    AND (pup.display_name = 'EM' OR pup.display_name LIKE 'EM%')
  LIMIT 1
)
SELECT
  user_id,
  total_tests_completed,
  total_questions_answered,
  overall_accuracy,
  current_streak_days,
  longest_streak_days,
  mastery_level,
  mastery_score,
  predicted_exam_readiness,
  last_analysis_date,
  updated_at
FROM user_learning_analytics
WHERE user_id = (SELECT id FROM em_user)
ORDER BY updated_at DESC
LIMIT 5;

-- 3. Ver TODOS los registros en user_learning_analytics para EM
WITH em_user AS (
  SELECT up.id
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE pup.ciudad = 'Palencia'
    AND (pup.display_name = 'EM' OR pup.display_name LIKE 'EM%')
  LIMIT 1
)
SELECT COUNT(*) as total_analytics_records_for_em
FROM user_learning_analytics
WHERE user_id = (SELECT id FROM em_user);

-- 4. Ver el registro más reciente con todos los campos
WITH em_user AS (
  SELECT up.id
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE pup.ciudad = 'Palencia'
    AND (pup.display_name = 'EM' OR pup.display_name LIKE 'EM%')
  LIMIT 1
)
SELECT *
FROM user_learning_analytics
WHERE user_id = (SELECT id FROM em_user)
ORDER BY updated_at DESC
LIMIT 1;

-- 5. Comparar con lo que devuelve la función RPC
WITH em_user AS (
  SELECT up.id
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE pup.ciudad = 'Palencia'
    AND (pup.display_name = 'EM' OR pup.display_name LIKE 'EM%')
  LIMIT 1
)
SELECT
  'user_learning_analytics' as source,
  total_tests_completed,
  total_questions_answered,
  overall_accuracy,
  current_streak_days
FROM user_learning_analytics
WHERE user_id = (SELECT id FROM em_user)
ORDER BY updated_at DESC
LIMIT 1
UNION ALL
SELECT
  'get_user_public_stats RPC' as source,
  total_tests_completed,
  total_questions as total_questions_answered,
  global_accuracy as overall_accuracy,
  current_streak as current_streak_days
FROM get_user_public_stats((SELECT id FROM em_user));

-- 6. Ver si user_learning_analytics está actualizada
WITH em_user AS (
  SELECT up.id
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE pup.ciudad = 'Palencia'
    AND (pup.display_name = 'EM' OR pup.display_name LIKE 'EM%')
  LIMIT 1
)
SELECT
  user_id,
  updated_at,
  NOW() - updated_at as time_since_update,
  total_questions_answered,
  CASE
    WHEN updated_at < NOW() - INTERVAL '1 day' THEN '⚠️ DESACTUALIZADA (más de 1 día)'
    WHEN updated_at < NOW() - INTERVAL '1 hour' THEN '⚠️ Puede estar desactualizada'
    ELSE '✅ Actualizada recientemente'
  END as status
FROM user_learning_analytics
WHERE user_id = (SELECT id FROM em_user)
ORDER BY updated_at DESC
LIMIT 1;