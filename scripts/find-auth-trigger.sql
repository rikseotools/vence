-- Buscar triggers en auth.users que puedan estar causando el problema
SELECT 
  t.trigger_name,
  t.event_manipulation,
  t.action_statement,
  t.action_timing,
  t.event_object_table
FROM information_schema.triggers t
WHERE t.event_object_schema = 'auth'
  AND t.event_object_table = 'users'
ORDER BY t.trigger_name;
