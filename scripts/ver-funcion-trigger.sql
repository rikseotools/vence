-- VER QUÉ HACE LA FUNCIÓN trigger_update_user_analytics

-- 1. Ver el código de la función
SELECT
  routine_name as "Función",
  routine_definition as "Código"
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'trigger_update_user_analytics';

-- 2. Ver cuándo se actualiza user_learning_analytics
-- Verificar si el trigger está funcionando viendo actualizaciones recientes
SELECT
  user_id,
  updated_at,
  NOW() - updated_at as "Tiempo desde actualización",
  total_tests_completed,
  total_questions_answered
FROM user_learning_analytics
ORDER BY updated_at DESC
LIMIT 10;

-- 3. Ver tests completados recientemente para verificar si deberían haber disparado el trigger
SELECT
  t.id as test_id,
  t.user_id,
  t.is_completed,
  t.updated_at as test_updated,
  ula.updated_at as analytics_updated,
  CASE
    WHEN ula.updated_at IS NULL THEN '❌ No tiene analytics'
    WHEN ula.updated_at < t.updated_at THEN '⚠️ Analytics desactualizada'
    ELSE '✅ Analytics actualizada'
  END as estado
FROM tests t
LEFT JOIN user_learning_analytics ula ON ula.user_id = t.user_id
WHERE t.is_completed = true
  AND t.updated_at > NOW() - INTERVAL '7 days'
ORDER BY t.updated_at DESC
LIMIT 20;