-- Ver TODAS las tablas relacionadas con estadísticas en la base de datos
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size(table_name::regclass)) as size
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name LIKE '%stat%'
    OR table_name LIKE '%metric%'
    OR table_name LIKE '%analytics%'
    OR table_name LIKE '%progress%'
    OR table_name LIKE '%learning%'
    OR table_name LIKE '%performance%'
  )
ORDER BY table_name;

-- Ver estructura de user_learning_analytics
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_learning_analytics'
ORDER BY ordinal_position;

-- Ver estructura de user_progress
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_progress'
ORDER BY ordinal_position;

-- Ver si hay datos para el usuario EM de Palencia en user_learning_analytics
SELECT * FROM user_learning_analytics
WHERE user_id = (
  SELECT up.id
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE pup.ciudad = 'Palencia'
    AND (pup.display_name LIKE 'EM%' OR pup.display_name = 'EM')
  LIMIT 1
);

-- Ver cuántos registros hay en cada tabla
SELECT
  'user_learning_analytics' as table_name,
  COUNT(*) as total_records
FROM user_learning_analytics
UNION ALL
SELECT
  'user_progress',
  COUNT(*)
FROM user_progress
UNION ALL
SELECT
  'user_notification_metrics',
  COUNT(*)
FROM user_notification_metrics
UNION ALL
SELECT
  'article_exam_stats',
  COUNT(*)
FROM article_exam_stats;