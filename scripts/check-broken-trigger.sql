-- Verificar triggers que puedan estar rotos

-- 1. Ver todos los triggers en la tabla auth.users
SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND event_object_schema = 'auth';

-- 2. Ver funciones que referencian public_user_profiles
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_definition LIKE '%public_user_profiles%'
  AND routine_schema = 'public';

-- 3. Ver si la tabla user_profiles existe
SELECT table_name, table_schema
FROM information_schema.tables
WHERE table_name IN ('user_profiles', 'public_user_profiles');
