-- Verificar triggers activos relacionados con rachas

-- 1. Ver todos los triggers en la tabla tests
SELECT
  trigger_name,
  event_object_table,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'tests'
ORDER BY trigger_name;

-- 2. Ver la función update_user_streak_optimized
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%streak%';

-- 3. Ver si existe recalculate_all_streaks
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'recalculate_all_streaks';

-- 4. Verificar casos donde la racha es mayor que días desde created_at
SELECT
  up.full_name,
  up.created_at,
  DATE_PART('day', NOW() - up.created_at)::INTEGER as dias_en_plataforma,
  us.current_streak,
  us.longest_streak,
  us.last_activity_date
FROM user_streaks us
JOIN user_profiles up ON us.user_id = up.id
WHERE us.current_streak > DATE_PART('day', NOW() - up.created_at)::INTEGER
   OR us.longest_streak > DATE_PART('day', NOW() - up.created_at)::INTEGER
ORDER BY us.current_streak DESC;
