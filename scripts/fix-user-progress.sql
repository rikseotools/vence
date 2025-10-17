-- scripts/fix-user-progress.sql
-- MIGRACIÓN: Crear registros user_progress basados en tests completados

-- 1. Verificar estructura actual de user_progress
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_progress' 
ORDER BY ordinal_position;

-- 2. Mostrar estadísticas actuales
SELECT 
  'tests_completados' as tipo, 
  COUNT(*) as cantidad 
FROM tests 
WHERE is_completed = true AND user_id IS NOT NULL
UNION ALL
SELECT 
  'user_progress_existente' as tipo, 
  COUNT(*) as cantidad 
FROM user_progress;

-- 3. Insertar registros user_progress basados en tests completados
-- (Ajustar columnas según la estructura real que veamos arriba)

WITH test_stats AS (
  SELECT 
    t.user_id,
    tq.tema_number,
    COUNT(DISTINCT t.id) as tests_completed,
    ROUND(AVG((t.score::float / t.total_questions::float) * 100)) as avg_accuracy,
    MAX((t.score::float / t.total_questions::float) * 100) as best_accuracy,
    MIN(t.completed_at) as first_test_date,
    MAX(t.completed_at) as last_test_date,
    CASE 
      WHEN AVG((t.score::float / t.total_questions::float) * 100) >= 70 THEN 1 
      ELSE 0 
    END as current_streak
  FROM tests t
  INNER JOIN test_questions tq ON t.id = tq.test_id
  WHERE t.is_completed = true 
    AND t.user_id IS NOT NULL
    AND tq.tema_number IS NOT NULL 
    AND tq.tema_number > 0
  GROUP BY t.user_id, tq.tema_number
)
SELECT 
  user_id,
  tema_number as topic_number,
  tests_completed,
  avg_accuracy,
  best_accuracy,
  first_test_date as unlock_date,
  last_test_date,
  current_streak,
  true as is_unlocked
FROM test_stats
ORDER BY user_id, topic_number;

-- 4. Después de ver los datos arriba, ejecutar este INSERT:
-- (Comentado por ahora hasta verificar las columnas exactas)

/*
INSERT INTO user_progress (
  user_id, 
  topic_number, 
  tests_completed,
  -- Agregar las columnas que realmente existan
  created_at,
  updated_at
)
SELECT 
  user_id,
  tema_number,
  tests_completed,
  NOW(),
  NOW()
FROM (
  SELECT 
    t.user_id,
    tq.tema_number,
    COUNT(DISTINCT t.id) as tests_completed
  FROM tests t
  INNER JOIN test_questions tq ON t.id = tq.test_id
  WHERE t.is_completed = true 
    AND t.user_id IS NOT NULL
    AND tq.tema_number IS NOT NULL 
    AND tq.tema_number > 0
  GROUP BY t.user_id, tq.tema_number
) stats
WHERE NOT EXISTS (
  SELECT 1 FROM user_progress up 
  WHERE up.user_id = stats.user_id 
    AND up.topic_number = stats.tema_number
);
*/