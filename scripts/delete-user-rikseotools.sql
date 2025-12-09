-- Eliminar usuario rikseotools@gmail.com (ID: 46a7d734-4374-4afb-ba04-a0983c4b702b)
-- CUIDADO: Esto eliminará TODOS los datos asociados al usuario

-- El usuario tiene datos desde: 2025-06-28

-- Gracias a ON DELETE CASCADE, solo necesitamos eliminar de auth.users
-- y automáticamente se eliminará de:
-- - user_profiles
-- - public_user_profiles
-- - tests
-- - test_questions
-- - user_question_history
-- - y todas las demás tablas relacionadas

DELETE FROM auth.users
WHERE email = 'rikseotools@gmail.com'
  AND id = '46a7d734-4374-4afb-ba04-a0983c4b702b';

-- Verificar que se eliminó
SELECT COUNT(*) as usuarios_restantes
FROM auth.users
WHERE email = 'rikseotools@gmail.com';
