-- Investigar por qué Inma tiene 6 días en Vence pero racha de 9 días
-- Esto es imposible: la racha no puede ser mayor que los días en la plataforma

-- 1. Ver datos básicos de Inma
SELECT
  up.id,
  up.email,
  up.full_name,
  pup.display_name,
  pup.ciudad,
  up.created_at as fecha_registro,
  NOW() as fecha_actual,
  DATE_PART('day', NOW() - up.created_at) as dias_reales_en_vence,
  -- Ver la racha de diferentes fuentes
  (SELECT current_streak FROM user_streaks WHERE user_id = up.id) as racha_user_streaks,
  (SELECT current_streak FROM get_user_public_stats(up.id)) as racha_rpc,
  calculate_user_streak(up.id) as racha_calculada_funcion
FROM user_profiles up
LEFT JOIN public_user_profiles pup ON pup.id = up.id
WHERE
  LOWER(COALESCE(up.full_name, '')) LIKE '%inma%'
  OR LOWER(COALESCE(up.email, '')) LIKE '%inma%'
  OR LOWER(COALESCE(pup.display_name, '')) LIKE '%inma%';

-- 2. Ver el historial de tests de Inma por día
-- Para entender cómo es posible una racha de 9 días
WITH inma_user AS (
  SELECT id
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE
    LOWER(COALESCE(up.full_name, '')) LIKE '%inma%'
    OR LOWER(COALESCE(up.email, '')) LIKE '%inma%'
    OR LOWER(COALESCE(pup.display_name, '')) LIKE '%inma%'
  LIMIT 1
)
SELECT
  DATE(t.completed_at) as dia,
  COUNT(*) as tests_ese_dia,
  MIN(t.completed_at) as primer_test,
  MAX(t.completed_at) as ultimo_test,
  DATE_PART('day', NOW() - DATE(t.completed_at)) as hace_cuantos_dias
FROM tests t
WHERE t.user_id IN (SELECT id FROM inma_user)
  AND t.completed_at IS NOT NULL
  AND t.is_completed = true
GROUP BY DATE(t.completed_at)
ORDER BY dia DESC;

-- 3. Ver la tabla user_streaks para Inma
SELECT
  us.*,
  DATE_PART('day', NOW() - us.last_activity_date) as dias_desde_ultima_actividad
FROM user_streaks us
WHERE us.user_id IN (
  SELECT up.id
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE
    LOWER(COALESCE(up.full_name, '')) LIKE '%inma%'
    OR LOWER(COALESCE(up.email, '')) LIKE '%inma%'
    OR LOWER(COALESCE(pup.display_name, '')) LIKE '%inma%'
);

-- 4. POSIBLE CAUSA: ¿La racha se calculó incorrectamente incluyendo días antes del registro?
-- Ver si hay tests con fecha ANTERIOR a la fecha de registro del usuario
WITH inma_user AS (
  SELECT id, created_at as fecha_registro
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE
    LOWER(COALESCE(up.full_name, '')) LIKE '%inma%'
    OR LOWER(COALESCE(up.email, '')) LIKE '%inma%'
    OR LOWER(COALESCE(pup.display_name, '')) LIKE '%inma%'
  LIMIT 1
)
SELECT
  t.id,
  t.completed_at as fecha_test,
  iu.fecha_registro,
  DATE_PART('day', iu.fecha_registro - t.completed_at) as dias_antes_del_registro,
  CASE
    WHEN t.completed_at < iu.fecha_registro THEN '⚠️ TEST ANTES DEL REGISTRO'
    ELSE '✅ Test después del registro'
  END as validez
FROM tests t
CROSS JOIN inma_user iu
WHERE t.user_id = iu.id
  AND t.completed_at IS NOT NULL
ORDER BY t.completed_at;

-- 5. OTRA POSIBLE CAUSA: ¿Se actualizó manualmente la tabla user_streaks?
-- Ver el historial de updates en user_streaks (si existe audit)
SELECT
  us.user_id,
  up.email,
  us.current_streak,
  us.longest_streak,
  us.last_activity_date,
  us.streak_updated_at,
  DATE_PART('day', NOW() - up.created_at) as dias_en_vence_reales,
  CASE
    WHEN us.current_streak > DATE_PART('day', NOW() - up.created_at) + 1 THEN '⚠️ RACHA IMPOSIBLE (mayor que días en Vence)'
    ELSE '✅ Racha válida'
  END as validacion
FROM user_streaks us
JOIN user_profiles up ON up.id = us.user_id
LEFT JOIN public_user_profiles pup ON pup.id = up.id
WHERE
  LOWER(COALESCE(up.full_name, '')) LIKE '%inma%'
  OR LOWER(COALESCE(up.email, '')) LIKE '%inma%'
  OR LOWER(COALESCE(pup.display_name, '')) LIKE '%inma%';

-- 6. Ver si hay usuarios con rachas imposibles (mayor que días en Vence)
SELECT
  up.email,
  pup.display_name,
  DATE_PART('day', NOW() - up.created_at)::INTEGER as dias_en_vence,
  us.current_streak,
  us.current_streak - DATE_PART('day', NOW() - up.created_at)::INTEGER as diferencia,
  CASE
    WHEN us.current_streak > DATE_PART('day', NOW() - up.created_at) + 1 THEN '⚠️ IMPOSIBLE'
    ELSE '✅ OK'
  END as estado
FROM user_profiles up
LEFT JOIN public_user_profiles pup ON pup.id = up.id
LEFT JOIN user_streaks us ON us.user_id = up.id
WHERE us.current_streak > DATE_PART('day', NOW() - up.created_at) + 1
ORDER BY diferencia DESC;