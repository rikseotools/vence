-- Verificar el trigger calculate_user_streak que modificamos

SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'calculate_user_streak'
  AND n.nspname = 'public';

-- Ver qué tabla está usando
SELECT 
  p.proname,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%public_user_profiles%' THEN '❌ USA public_user_profiles (INCORRECTO)'
    WHEN pg_get_functiondef(p.oid) LIKE '%user_profiles%' THEN '✅ USA user_profiles (CORRECTO)'
    ELSE 'No usa user_profiles'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'calculate_user_streak'
  AND n.nspname = 'public';
