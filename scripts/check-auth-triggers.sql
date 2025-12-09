-- Verificar todos los triggers relacionados con auth.users
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  OR action_statement LIKE '%user_profiles%'
  OR trigger_name LIKE '%user%'
  OR trigger_name LIKE '%profile%'
ORDER BY event_object_table, trigger_name;

-- Ver funciones relacionadas con creación de perfiles
SELECT
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_name LIKE '%profile%'
    OR routine_name LIKE '%user%'
    OR routine_definition LIKE '%user_profiles%'
  )
ORDER BY routine_name;
