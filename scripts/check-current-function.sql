-- Verificar qué campos devuelve la función actual en producción
SELECT
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'get_user_public_stats';

-- O si necesitamos ver solo la estructura de retorno
SELECT
  routine_name,
  data_type,
  type_udt_name
FROM information_schema.routines
WHERE routine_name = 'get_user_public_stats';

-- Verificar qué columnas devuelve la función actual
SELECT column_name, data_type, ordinal_position
FROM information_schema.columns
WHERE table_name = 'get_user_public_stats'
ORDER BY ordinal_position;

-- Probar la función actual con un usuario conocido
SELECT * FROM get_user_public_stats(
  (SELECT id FROM user_profiles WHERE email = 'inmacorcuera72@gmail.com')
);