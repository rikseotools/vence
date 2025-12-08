-- Comparar qué datos devuelve la RPC para diferentes usuarios
-- para entender por qué David e Inma son diferentes

-- 1. Primero, buscar usuarios con auxiliar_administrativo_estado y ver sus datos
SELECT
  up.id,
  up.email,
  up.full_name,
  pup.display_name,
  up.target_oposicion,
  up.created_at,
  DATE_PART('day', NOW() - up.created_at)::INTEGER as days_in_vence,
  -- Contar tests
  (SELECT COUNT(*) FROM tests WHERE user_id = up.id) as total_tests_count,
  (SELECT COUNT(*) FROM tests WHERE user_id = up.id AND is_completed = true) as completed_tests_count,
  -- Ver si tienen test_questions
  (SELECT COUNT(*) FROM test_questions tq
   INNER JOIN tests t ON t.id = tq.test_id
   WHERE t.user_id = up.id) as total_questions_answered
FROM user_profiles up
LEFT JOIN public_user_profiles pup ON pup.id = up.id
WHERE up.target_oposicion = 'auxiliar_administrativo_estado'
  AND up.created_at > NOW() - INTERVAL '60 days'  -- Usuarios relativamente nuevos
ORDER BY days_in_vence DESC
LIMIT 20;

-- 2. Buscar específicamente a David e Inma
SELECT
  up.id,
  up.email,
  up.full_name,
  pup.display_name,
  pup.ciudad,
  up.target_oposicion,
  up.created_at
FROM user_profiles up
LEFT JOIN public_user_profiles pup ON pup.id = up.id
WHERE
  LOWER(COALESCE(up.full_name, '')) LIKE '%david%'
  OR LOWER(COALESCE(up.email, '')) LIKE '%david%'
  OR LOWER(COALESCE(pup.display_name, '')) LIKE '%david%'
  OR LOWER(COALESCE(up.full_name, '')) LIKE '%inma%'
  OR LOWER(COALESCE(up.email, '')) LIKE '%inma%'
  OR LOWER(COALESCE(pup.display_name, '')) LIKE '%inma%';

-- 3. Para los IDs encontrados de David e Inma, verificar qué devuelve la RPC
-- REEMPLAZAR CON LOS IDS REALES
/*
SELECT * FROM get_user_public_stats('ID_DE_DAVID');
SELECT * FROM get_user_public_stats('ID_DE_INMA');
*/

-- 4. Comparar la estructura de datos de tests para diferentes usuarios
WITH user_test_summary AS (
  SELECT
    up.email,
    up.target_oposicion,
    COUNT(DISTINCT t.id) as test_count,
    COUNT(DISTINCT CASE WHEN t.is_completed = true THEN t.id END) as completed_count,
    COUNT(DISTINCT CASE WHEN t.is_completed = false THEN t.id END) as incomplete_count,
    COUNT(DISTINCT CASE WHEN t.is_completed IS NULL THEN t.id END) as null_completed_count,
    COUNT(DISTINCT tq.id) as question_count,
    MIN(t.created_at) as first_test_date,
    MAX(t.created_at) as last_test_date
  FROM user_profiles up
  LEFT JOIN tests t ON t.user_id = up.id
  LEFT JOIN test_questions tq ON tq.test_id = t.id
  WHERE up.target_oposicion = 'auxiliar_administrativo_estado'
  GROUP BY up.email, up.target_oposicion
  HAVING COUNT(DISTINCT t.id) > 0
)
SELECT * FROM user_test_summary
ORDER BY completed_count DESC
LIMIT 30;

-- 5. Ver si hay algo especial en la tabla test_questions para David/Inma
-- Verificar si sus tests tienen questions asociadas
SELECT
  t.user_id,
  up.email,
  t.id as test_id,
  t.title,
  t.is_completed,
  t.completed_at,
  t.total_questions as expected_questions,
  COUNT(tq.id) as actual_questions_in_test_questions
FROM tests t
LEFT JOIN test_questions tq ON tq.test_id = t.id
LEFT JOIN user_profiles up ON up.id = t.user_id
WHERE up.email LIKE '%david%' OR up.email LIKE '%inma%'
GROUP BY t.user_id, up.email, t.id, t.title, t.is_completed, t.completed_at, t.total_questions
ORDER BY t.created_at DESC;

-- 6. Verificar si el problema es con la función calculate_user_streak
-- que podría estar devolviendo NULL o causando problemas
SELECT
  up.email,
  calculate_user_streak(up.id) as calculated_streak,
  (SELECT current_streak FROM user_streaks WHERE user_id = up.id) as stored_streak
FROM user_profiles up
WHERE up.email LIKE '%david%' OR up.email LIKE '%inma%';