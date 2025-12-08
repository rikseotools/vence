-- Investigación específica de David e Inma que tienen preguntas respondidas pero 0 tests completados

-- 1. Encontrar a David e Inma y ver su situación
SELECT
  up.id,
  up.email,
  up.full_name,
  pup.display_name,
  pup.ciudad,
  up.target_oposicion,
  -- Contar tests en la tabla tests
  (SELECT COUNT(*) FROM tests WHERE user_id = up.id) as tests_totales,
  (SELECT COUNT(*) FROM tests WHERE user_id = up.id AND is_completed = true) as tests_is_completed_true,
  (SELECT COUNT(*) FROM tests WHERE user_id = up.id AND is_completed = false) as tests_is_completed_false,
  (SELECT COUNT(*) FROM tests WHERE user_id = up.id AND is_completed IS NULL) as tests_is_completed_null,
  (SELECT COUNT(*) FROM tests WHERE user_id = up.id AND completed_at IS NOT NULL) as tests_con_completed_at,
  -- Contar respuestas en detailed_answers
  (SELECT COUNT(*) FROM detailed_answers WHERE user_id = up.id) as respuestas_detailed_answers,
  (SELECT COUNT(DISTINCT test_session_id) FROM detailed_answers WHERE user_id = up.id) as sesiones_unicas_detailed_answers,
  -- Lo que devuelve la RPC
  (SELECT total_tests_completed FROM get_user_public_stats(up.id)) as rpc_tests_completed
FROM user_profiles up
LEFT JOIN public_user_profiles pup ON pup.id = up.id
WHERE
  LOWER(COALESCE(up.full_name, '')) LIKE '%david%'
  OR LOWER(COALESCE(up.email, '')) LIKE '%david%'
  OR LOWER(COALESCE(pup.display_name, '')) LIKE '%david%'
  OR LOWER(COALESCE(up.full_name, '')) LIKE '%inma%'
  OR LOWER(COALESCE(up.email, '')) LIKE '%inma%'
  OR LOWER(COALESCE(pup.display_name, '')) LIKE '%inma%';

-- 2. Ver TODOS los tests de David e Inma en detalle
SELECT
  t.id as test_id,
  up.email,
  pup.display_name,
  t.title,
  t.test_type,
  t.is_completed,
  t.completed_at,
  t.created_at,
  t.score,
  t.total_questions,
  t.questions_answered,
  t.correct_answers,
  -- Contar respuestas en detailed_answers para este test
  (SELECT COUNT(*) FROM detailed_answers WHERE test_session_id = t.id) as respuestas_en_detailed_answers,
  CASE
    WHEN t.is_completed = true THEN '✅ Completado'
    WHEN t.is_completed = false AND t.completed_at IS NOT NULL THEN '⚠️ completed_at pero is_completed=false'
    WHEN t.is_completed = false THEN '❌ is_completed=false'
    WHEN t.is_completed IS NULL AND t.completed_at IS NOT NULL THEN '⚠️ completed_at pero is_completed=NULL'
    WHEN t.is_completed IS NULL THEN '❓ is_completed=NULL'
  END as estado
FROM tests t
JOIN user_profiles up ON up.id = t.user_id
LEFT JOIN public_user_profiles pup ON pup.id = up.id
WHERE
  LOWER(COALESCE(up.full_name, '')) LIKE '%david%'
  OR LOWER(COALESCE(up.email, '')) LIKE '%david%'
  OR LOWER(COALESCE(pup.display_name, '')) LIKE '%david%'
  OR LOWER(COALESCE(up.full_name, '')) LIKE '%inma%'
  OR LOWER(COALESCE(up.email, '')) LIKE '%inma%'
  OR LOWER(COALESCE(pup.display_name, '')) LIKE '%inma%'
ORDER BY t.created_at DESC;

-- 3. HIPÓTESIS: ¿Tienen respuestas en detailed_answers pero no tests en la tabla tests?
-- O ¿tienen tests pero todos con is_completed = false/NULL?
SELECT
  up.email,
  pup.display_name,
  'Respuestas sin test' as tipo,
  COUNT(DISTINCT da.test_session_id) as test_sessions_en_detailed_answers,
  COUNT(DISTINCT t.id) as test_ids_en_tabla_tests
FROM user_profiles up
LEFT JOIN public_user_profiles pup ON pup.id = up.id
LEFT JOIN detailed_answers da ON da.user_id = up.id
LEFT JOIN tests t ON t.id = da.test_session_id
WHERE
  LOWER(COALESCE(up.full_name, '')) LIKE '%david%'
  OR LOWER(COALESCE(up.email, '')) LIKE '%david%'
  OR LOWER(COALESCE(pup.display_name, '')) LIKE '%david%'
  OR LOWER(COALESCE(up.full_name, '')) LIKE '%inma%'
  OR LOWER(COALESCE(up.email, '')) LIKE '%inma%'
  OR LOWER(COALESCE(pup.display_name, '')) LIKE '%inma%'
GROUP BY up.email, pup.display_name;

-- 4. Ver test_sessions en detailed_answers que NO existen en tests
SELECT
  da.user_id,
  up.email,
  pup.display_name,
  da.test_session_id,
  COUNT(*) as respuestas,
  MIN(da.created_at) as primera_respuesta,
  MAX(da.created_at) as ultima_respuesta,
  EXISTS(SELECT 1 FROM tests WHERE id = da.test_session_id) as existe_en_tests
FROM detailed_answers da
JOIN user_profiles up ON up.id = da.user_id
LEFT JOIN public_user_profiles pup ON pup.id = up.id
WHERE
  (LOWER(COALESCE(up.full_name, '')) LIKE '%david%'
  OR LOWER(COALESCE(up.email, '')) LIKE '%david%'
  OR LOWER(COALESCE(pup.display_name, '')) LIKE '%david%'
  OR LOWER(COALESCE(up.full_name, '')) LIKE '%inma%'
  OR LOWER(COALESCE(up.email, '')) LIKE '%inma%'
  OR LOWER(COALESCE(pup.display_name, '')) LIKE '%inma%')
GROUP BY da.user_id, up.email, pup.display_name, da.test_session_id
ORDER BY ultima_respuesta DESC;

-- 5. Comparar con un usuario que SÍ funciona correctamente
-- (por ejemplo, un usuario con muchos tests completados correctamente)
SELECT
  up.email,
  (SELECT COUNT(*) FROM tests WHERE user_id = up.id) as tests_totales,
  (SELECT COUNT(*) FROM tests WHERE user_id = up.id AND is_completed = true) as tests_completed,
  (SELECT COUNT(*) FROM detailed_answers WHERE user_id = up.id) as respuestas,
  (SELECT total_tests_completed FROM get_user_public_stats(up.id)) as rpc_tests_completed
FROM user_profiles up
WHERE up.target_oposicion = 'auxiliar_administrativo_estado'
  AND EXISTS (SELECT 1 FROM tests WHERE user_id = up.id AND is_completed = true)
ORDER BY (SELECT COUNT(*) FROM tests WHERE user_id = up.id AND is_completed = true) DESC
LIMIT 5;