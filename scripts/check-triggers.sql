-- VERIFICAR SI HAY TRIGGERS ACTIVOS PARA user_learning_analytics

-- 1. Ver TODOS los triggers en la base de datos
SELECT
  trigger_name,
  event_object_table as tabla,
  event_manipulation as evento,
  action_timing as cuando,
  action_statement as accion
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 2. Buscar específicamente triggers relacionados con user_learning_analytics
SELECT
  trigger_name,
  event_object_table,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND (
    action_statement LIKE '%user_learning_analytics%'
    OR event_object_table = 'user_learning_analytics'
  );

-- 3. Ver si existe el trigger update_analytics_on_test_complete
SELECT
  trigger_name,
  event_object_table,
  event_manipulation,
  EXISTS(
    SELECT 1
    FROM information_schema.triggers
    WHERE trigger_name = 'update_analytics_on_test_complete'
  ) as exists_trigger
FROM information_schema.triggers
WHERE trigger_name = 'update_analytics_on_test_complete';

-- 4. Ver si existe la función update_user_learning_analytics
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'update_user_learning_analytics';

-- 5. Ver cuándo fue la última modificación en user_learning_analytics
SELECT
  MAX(updated_at) as ultima_actualizacion,
  NOW() - MAX(updated_at) as tiempo_desde_ultima_actualizacion,
  COUNT(*) as total_registros
FROM user_learning_analytics;

-- 6. Ver si hay actualizaciones recientes (últimas 24 horas)
SELECT
  COUNT(*) as actualizaciones_ultimas_24h
FROM user_learning_analytics
WHERE updated_at > NOW() - INTERVAL '24 hours';

-- 7. Ver si hay actualizaciones recientes (última semana)
SELECT
  COUNT(*) as actualizaciones_ultima_semana
FROM user_learning_analytics
WHERE updated_at > NOW() - INTERVAL '7 days';