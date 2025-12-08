-- Debug: Por qué algunos usuarios muestran "Tests completados: 0"

-- 1. Verificar qué usuarios tienen tests pero aparecen con 0 tests completados
SELECT
  up.id,
  up.email,
  up.full_name,
  pup.display_name,
  up.target_oposicion,
  -- Tests reales en la BD
  (SELECT COUNT(*) FROM tests WHERE user_id = up.id) as total_tests_real,
  (SELECT COUNT(*) FROM tests WHERE user_id = up.id AND is_completed = true) as tests_completed_real,
  (SELECT COUNT(*) FROM tests WHERE user_id = up.id AND is_completed = false) as tests_not_completed,
  (SELECT COUNT(*) FROM tests WHERE user_id = up.id AND is_completed IS NULL) as tests_null_completed,
  -- Lo que devuelve la RPC
  (SELECT total_tests_completed FROM get_user_public_stats(up.id)) as rpc_tests_completed
FROM user_profiles up
LEFT JOIN public_user_profiles pup ON pup.id = up.id
WHERE
  LOWER(COALESCE(up.full_name, '')) LIKE '%inma%'
  OR LOWER(COALESCE(up.email, '')) LIKE '%inma%'
  OR LOWER(COALESCE(pup.display_name, '')) LIKE '%inma%'
  OR LOWER(COALESCE(up.full_name, '')) LIKE '%david%'
  OR LOWER(COALESCE(up.email, '')) LIKE '%david%'
  OR LOWER(COALESCE(pup.display_name, '')) LIKE '%david%';

-- 2. Ver el detalle de los tests de estos usuarios
-- ¿El problema es que is_completed está en false o NULL?
SELECT
  t.id,
  t.user_id,
  up.email,
  t.title,
  t.test_type,
  t.is_completed,
  t.completed_at,
  t.created_at,
  t.total_questions,
  t.score,
  CASE
    WHEN t.is_completed = true THEN '✅ Completado'
    WHEN t.is_completed = false THEN '❌ No completado'
    WHEN t.is_completed IS NULL THEN '❓ NULL'
  END as estado
FROM tests t
JOIN user_profiles up ON up.id = t.user_id
WHERE up.email LIKE '%inma%' OR up.email LIKE '%david%'
ORDER BY t.created_at DESC
LIMIT 20;

-- 3. Verificar si hay usuarios con muchos tests pero ninguno marcado como completado
SELECT
  up.email,
  up.target_oposicion,
  COUNT(t.id) as total_tests,
  COUNT(CASE WHEN t.is_completed = true THEN 1 END) as completed_true,
  COUNT(CASE WHEN t.is_completed = false THEN 1 END) as completed_false,
  COUNT(CASE WHEN t.is_completed IS NULL THEN 1 END) as completed_null,
  COUNT(CASE WHEN t.completed_at IS NOT NULL THEN 1 END) as has_completed_at,
  ROUND(100.0 * COUNT(CASE WHEN t.is_completed = true THEN 1 END) / NULLIF(COUNT(t.id), 0), 1) as pct_completed
FROM user_profiles up
JOIN tests t ON t.user_id = up.id
GROUP BY up.email, up.target_oposicion
HAVING COUNT(t.id) > 0
ORDER BY pct_completed ASC
LIMIT 20;

-- 4. Hipótesis: ¿Hay un problema con tests antiguos que no tienen is_completed?
-- Ver distribución por fecha
SELECT
  DATE_TRUNC('month', t.created_at) as mes,
  COUNT(*) as total_tests,
  COUNT(CASE WHEN t.is_completed = true THEN 1 END) as completed_true,
  COUNT(CASE WHEN t.is_completed = false THEN 1 END) as completed_false,
  COUNT(CASE WHEN t.is_completed IS NULL THEN 1 END) as completed_null,
  ROUND(100.0 * COUNT(CASE WHEN t.is_completed IS NULL THEN 1 END) / COUNT(*), 1) as pct_null
FROM tests t
GROUP BY DATE_TRUNC('month', t.created_at)
ORDER BY mes DESC;

-- 5. FIX POSIBLE: Si hay tests con completed_at pero is_completed no está en true
-- Primero verificar cuántos hay:
SELECT
  COUNT(*) as tests_con_problema,
  COUNT(DISTINCT user_id) as usuarios_afectados
FROM tests
WHERE completed_at IS NOT NULL
  AND (is_completed = false OR is_completed IS NULL);

-- Si hay muchos, el fix sería:
/*
UPDATE tests
SET is_completed = true
WHERE completed_at IS NOT NULL
  AND (is_completed = false OR is_completed IS NULL);
*/

-- 6. Alternativamente, si el problema es que tests antiguos no tienen is_completed
-- pero tienen score > 0, podríamos:
SELECT
  COUNT(*) as tests_con_score_sin_completed,
  COUNT(DISTINCT user_id) as usuarios_afectados
FROM tests
WHERE score IS NOT NULL
  AND score > 0
  AND (is_completed = false OR is_completed IS NULL);

-- Fix alternativo:
/*
UPDATE tests
SET is_completed = true
WHERE score IS NOT NULL
  AND score > 0
  AND (is_completed = false OR is_completed IS NULL);
*/