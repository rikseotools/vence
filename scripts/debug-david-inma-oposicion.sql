-- Debug específico para David e Inma: por qué muestran "Tests completados" en lugar de "Temas dominados"

-- 1. Encontrar a David e Inma y ver su target_oposicion
SELECT
  up.id,
  up.email,
  up.full_name,
  pup.display_name,
  pup.ciudad,
  up.target_oposicion,  -- ESTE ES EL CAMPO CLAVE
  up.created_at,
  DATE_PART('day', NOW() - up.created_at)::INTEGER as days_in_vence
FROM user_profiles up
LEFT JOIN public_user_profiles pup ON pup.id = up.id
WHERE
  LOWER(COALESCE(up.full_name, '')) LIKE '%david%'
  OR LOWER(COALESCE(up.email, '')) LIKE '%david%'
  OR LOWER(COALESCE(pup.display_name, '')) LIKE '%david%'
  OR LOWER(COALESCE(up.full_name, '')) LIKE '%inma%'
  OR LOWER(COALESCE(up.email, '')) LIKE '%inma%'
  OR LOWER(COALESCE(pup.display_name, '')) LIKE '%inma%';

-- 2. Para los usuarios encontrados, ejecutar la RPC y ver qué devuelve
-- REEMPLAZAR CON LOS IDS REALES DE DAVID E INMA
/*
SELECT
  user_id,
  target_oposicion,  -- ¿Es NULL o tiene otro valor?
  total_tests,
  total_tests_completed,
  mastered_topics
FROM get_user_public_stats('ID_DE_DAVID_AQUI');

SELECT
  user_id,
  target_oposicion,  -- ¿Es NULL o tiene otro valor?
  total_tests,
  total_tests_completed,
  mastered_topics
FROM get_user_public_stats('ID_DE_INMA_AQUI');
*/

-- 3. Comparar con otros usuarios que SÍ muestran "Temas dominados"
-- (estos deberían tener target_oposicion = 'auxiliar_administrativo_estado')
SELECT
  up.id,
  up.email,
  up.target_oposicion,
  (SELECT target_oposicion FROM get_user_public_stats(up.id)) as rpc_target_oposicion,
  CASE
    WHEN up.target_oposicion = 'auxiliar_administrativo_estado' THEN 'Debería mostrar: Temas dominados'
    ELSE 'Debería mostrar: Tests completados'
  END as expected_display
FROM user_profiles up
WHERE up.target_oposicion IS NOT NULL
  AND up.created_at > NOW() - INTERVAL '30 days'
LIMIT 20;

-- 4. Verificar si hay algún problema con el valor específico
-- ¿Quizás tienen espacios extras o caracteres especiales?
SELECT
  up.id,
  up.email,
  up.target_oposicion,
  LENGTH(up.target_oposicion) as length,
  up.target_oposicion = 'auxiliar_administrativo_estado' as is_exact_match,
  LOWER(TRIM(up.target_oposicion)) = 'auxiliar_administrativo_estado' as is_trimmed_lower_match
FROM user_profiles up
WHERE
  LOWER(up.email) LIKE '%david%'
  OR LOWER(up.email) LIKE '%inma%'
  OR LOWER(up.full_name) LIKE '%david%'
  OR LOWER(up.full_name) LIKE '%inma%';

-- 5. Ver todos los valores únicos de target_oposicion en la base de datos
SELECT DISTINCT
  target_oposicion,
  COUNT(*) as user_count
FROM user_profiles
WHERE target_oposicion IS NOT NULL
GROUP BY target_oposicion
ORDER BY user_count DESC;

-- 6. Específicamente para David de Córdoba (basado en la info del screenshot)
SELECT
  up.id,
  up.email,
  up.full_name,
  pup.display_name,
  pup.ciudad,
  up.target_oposicion,
  up.target_oposicion = 'auxiliar_administrativo_estado' as is_aux_admin
FROM user_profiles up
LEFT JOIN public_user_profiles pup ON pup.id = up.id
WHERE pup.display_name LIKE '%David%'
  AND pup.ciudad LIKE '%Córdoba%';