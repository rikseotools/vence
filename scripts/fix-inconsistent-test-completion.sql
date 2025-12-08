-- Arreglar tests que tienen completed_at pero is_completed no está en true
-- Este es un fix de datos para corregir inconsistencias causadas por el bug en testAnalytics.js

-- 1. Verificar cuántos tests están afectados
SELECT
  COUNT(*) as tests_afectados,
  COUNT(DISTINCT user_id) as usuarios_afectados
FROM tests
WHERE completed_at IS NOT NULL
  AND (is_completed = false OR is_completed IS NULL);

-- 2. Arreglar la inconsistencia
-- Si un test tiene completed_at, debe tener is_completed = true
UPDATE tests
SET is_completed = true
WHERE completed_at IS NOT NULL
  AND (is_completed = false OR is_completed IS NULL);

-- 3. Verificar que se arregló
SELECT
  up.email,
  COUNT(t.id) as total_tests,
  COUNT(CASE WHEN t.is_completed = true THEN 1 END) as tests_completados,
  (SELECT total_tests_completed FROM get_user_public_stats(up.id)) as rpc_tests_completed
FROM user_profiles up
LEFT JOIN tests t ON t.user_id = up.id
WHERE up.email LIKE '%inma%'
   OR up.email LIKE '%david%'
   OR EXISTS (
     SELECT 1 FROM public_user_profiles pup
     WHERE pup.id = up.id
     AND (LOWER(pup.display_name) LIKE '%inma%' OR LOWER(pup.display_name) LIKE '%david%')
   )
GROUP BY up.id, up.email;