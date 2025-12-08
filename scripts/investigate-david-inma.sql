-- Investigar por qué David e Inma muestran 0 tests completados
-- mientras que otros usuarios no tienen este problema

-- 1. Buscar usuarios llamados David e Inma
WITH target_users AS (
  SELECT
    up.id,
    up.email,
    up.full_name,
    pup.display_name,
    pup.ciudad,
    up.target_oposicion,
    up.created_at,
    DATE_PART('day', NOW() - up.created_at) as days_in_vence
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE
    LOWER(up.full_name) LIKE '%david%'
    OR LOWER(up.email) LIKE '%david%'
    OR LOWER(pup.display_name) LIKE '%david%'
    OR LOWER(up.full_name) LIKE '%inma%'
    OR LOWER(up.email) LIKE '%inma%'
    OR LOWER(pup.display_name) LIKE '%inma%'
)
SELECT * FROM target_users;

-- 2. Para cada usuario encontrado, verificar sus tests
-- REEMPLAZAR los IDs encontrados arriba
WITH user_tests AS (
  SELECT
    user_id,
    COUNT(*) as total_tests_all,
    COUNT(CASE WHEN is_completed = true THEN 1 END) as tests_completed_true,
    COUNT(CASE WHEN is_completed = false THEN 1 END) as tests_not_completed,
    COUNT(CASE WHEN is_completed IS NULL THEN 1 END) as tests_null_completed,
    COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as tests_with_completed_at,
    MIN(created_at) as first_test,
    MAX(created_at) as last_test,
    MAX(CASE WHEN is_completed = true THEN created_at END) as last_completed_test
  FROM tests
  WHERE user_id IN (
    -- IDs de David e Inma aquí
    'USER_ID_1',
    'USER_ID_2'
  )
  GROUP BY user_id
)
SELECT * FROM user_tests;

-- 3. Verificar qué devuelve la RPC para estos usuarios
SELECT * FROM get_user_public_stats('USER_ID_DAVID');
SELECT * FROM get_user_public_stats('USER_ID_INMA');

-- 4. Comparar con un usuario que SÍ funciona bien
-- Por ejemplo, buscar usuarios con tests completados > 0
WITH working_users AS (
  SELECT
    up.id,
    up.email,
    up.target_oposicion,
    COUNT(t.id) as test_count,
    COUNT(CASE WHEN t.is_completed = true THEN 1 END) as completed_count
  FROM user_profiles up
  INNER JOIN tests t ON t.user_id = up.id
  WHERE up.target_oposicion = 'auxiliar_administrativo_estado'
  GROUP BY up.id, up.email, up.target_oposicion
  HAVING COUNT(CASE WHEN t.is_completed = true THEN 1 END) > 5
  LIMIT 5
)
SELECT * FROM working_users;

-- 5. Hipótesis: ¿Será que David e Inma tienen tests pero con is_completed = false o NULL?
-- Verificar la distribución de is_completed para todos los usuarios
SELECT
  up.email,
  up.target_oposicion,
  COUNT(t.id) as total_tests,
  COUNT(CASE WHEN t.is_completed = true THEN 1 END) as completed_true,
  COUNT(CASE WHEN t.is_completed = false THEN 1 END) as completed_false,
  COUNT(CASE WHEN t.is_completed IS NULL THEN 1 END) as completed_null,
  ROUND(COUNT(CASE WHEN t.is_completed = true THEN 1 END)::NUMERIC / NULLIF(COUNT(t.id), 0) * 100, 1) as pct_completed
FROM user_profiles up
LEFT JOIN tests t ON t.user_id = up.id
WHERE up.target_oposicion = 'auxiliar_administrativo_estado'
GROUP BY up.email, up.target_oposicion
HAVING COUNT(t.id) > 0
ORDER BY pct_completed ASC
LIMIT 20;

-- 6. Verificar si hay algo especial con test_questions para estos usuarios
-- ¿Tienen preguntas respondidas pero los tests no están marcados como completados?
WITH user_question_stats AS (
  SELECT
    t.user_id,
    COUNT(DISTINCT t.id) as unique_tests,
    COUNT(tq.id) as total_questions,
    COUNT(CASE WHEN t.is_completed = true THEN DISTINCT t.id END) as completed_tests,
    COUNT(CASE WHEN t.is_completed = false THEN DISTINCT t.id END) as incomplete_tests
  FROM tests t
  LEFT JOIN test_questions tq ON tq.test_id = t.id
  WHERE t.user_id IN ('USER_ID_DAVID', 'USER_ID_INMA')
  GROUP BY t.user_id
)
SELECT * FROM user_question_stats;