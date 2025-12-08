-- Investigar el usuario específico que tiene el problema de test con completed_at pero no is_completed

-- 1. Identificar cuál es el test y usuario afectado
SELECT
  t.id as test_id,
  t.user_id,
  up.email,
  up.full_name,
  pup.display_name,
  pup.ciudad,
  t.title,
  t.test_type,
  t.is_completed,
  t.completed_at,
  t.created_at,
  t.score,
  t.total_questions,
  t.total_time_seconds,
  DATE_PART('day', NOW() - t.created_at) as days_ago
FROM tests t
JOIN user_profiles up ON up.id = t.user_id
LEFT JOIN public_user_profiles pup ON pup.id = up.id
WHERE t.completed_at IS NOT NULL
  AND (t.is_completed = false OR t.is_completed IS NULL);

-- 2. Ver más detalles del usuario afectado
WITH affected_user AS (
  SELECT DISTINCT user_id
  FROM tests
  WHERE completed_at IS NOT NULL
    AND (is_completed = false OR is_completed IS NULL)
  LIMIT 1
)
SELECT
  up.id,
  up.email,
  up.full_name,
  pup.display_name,
  pup.ciudad,
  up.target_oposicion,
  up.created_at as user_created_at,
  DATE_PART('day', NOW() - up.created_at) as days_in_vence,
  (SELECT COUNT(*) FROM tests WHERE user_id = up.id) as total_tests_count,
  (SELECT COUNT(*) FROM tests WHERE user_id = up.id AND is_completed = true) as completed_tests_count,
  (SELECT COUNT(*) FROM tests WHERE user_id = up.id AND completed_at IS NOT NULL) as tests_with_completed_at,
  (SELECT total_tests_completed FROM get_user_public_stats(up.id)) as rpc_tests_completed
FROM user_profiles up
LEFT JOIN public_user_profiles pup ON pup.id = up.id
WHERE up.id IN (SELECT user_id FROM affected_user);

-- 3. Ver TODOS los tests de este usuario para entender el patrón
WITH affected_user AS (
  SELECT DISTINCT user_id
  FROM tests
  WHERE completed_at IS NOT NULL
    AND (is_completed = false OR is_completed IS NULL)
  LIMIT 1
)
SELECT
  t.id,
  t.title,
  t.test_type,
  t.is_completed,
  t.completed_at,
  t.created_at,
  t.score,
  t.total_questions,
  CASE
    WHEN t.is_completed = true THEN '✅ Completado correctamente'
    WHEN t.is_completed = false AND t.completed_at IS NOT NULL THEN '⚠️ PROBLEMA: completed_at pero is_completed=false'
    WHEN t.is_completed = false THEN '❌ No completado'
    WHEN t.is_completed IS NULL AND t.completed_at IS NOT NULL THEN '⚠️ PROBLEMA: completed_at pero is_completed=NULL'
    WHEN t.is_completed IS NULL THEN '❓ NULL'
  END as estado,
  DATE_PART('day', NOW() - t.created_at) as days_ago
FROM tests t
WHERE t.user_id IN (SELECT user_id FROM affected_user)
ORDER BY t.created_at DESC;

-- 4. Verificar si este usuario tiene respuestas guardadas para el test problemático
WITH problem_test AS (
  SELECT id, user_id
  FROM tests
  WHERE completed_at IS NOT NULL
    AND (is_completed = false OR is_completed IS NULL)
  LIMIT 1
)
SELECT
  pt.id as test_id,
  COUNT(da.id) as respuestas_guardadas,
  COUNT(DISTINCT da.question_id) as preguntas_diferentes,
  MIN(da.created_at) as primera_respuesta,
  MAX(da.created_at) as ultima_respuesta
FROM problem_test pt
LEFT JOIN detailed_answers da ON da.test_session_id = pt.id
GROUP BY pt.id;

-- 5. Ver si hay algún patrón con el campo questions_answered y correct_answers
SELECT
  t.id,
  t.title,
  t.total_questions,
  t.questions_answered,
  t.correct_answers,
  t.score,
  t.is_completed,
  t.completed_at,
  CASE
    WHEN t.questions_answered = t.total_questions THEN 'Todas las preguntas respondidas'
    WHEN t.questions_answered < t.total_questions THEN 'Faltan preguntas por responder'
    WHEN t.questions_answered IS NULL THEN 'Sin datos de preguntas respondidas'
  END as estado_preguntas
FROM tests t
WHERE t.completed_at IS NOT NULL
  AND (t.is_completed = false OR t.is_completed IS NULL);