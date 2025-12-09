-- Verificar que se está guardando test_url correctamente
-- Para el usuario Manuel (manueltrader@gmail.com)

-- 1. Ver los últimos tests de Manuel con test_url
SELECT
  t.id,
  t.test_url,
  t.title,
  t.created_at,
  t.is_completed,
  t.total_questions
FROM tests t
JOIN user_profiles up ON t.user_id = up.id
WHERE up.email = 'manueltrader@gmail.com'
ORDER BY t.created_at DESC
LIMIT 5;

-- 2. Ver TODOS los tests recientes con test_url (últimos 10 tests de cualquier usuario)
SELECT
  id,
  test_url,
  title,
  created_at,
  user_id
FROM tests
WHERE test_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
