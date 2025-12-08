-- Analizar las tablas clave para entender por qué no se usan

-- 1. Ver estructura de user_question_history (5.4 MB de datos!)
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_question_history'
ORDER BY ordinal_position
LIMIT 20;

-- 2. Ver ejemplos de user_question_history
SELECT * FROM user_question_history
ORDER BY created_at DESC
LIMIT 5;

-- 3. Comparar user_question_history vs test_questions
SELECT
  'user_question_history' as tabla,
  COUNT(*) as registros,
  MIN(created_at) as primer_registro,
  MAX(created_at) as ultimo_registro
FROM user_question_history
UNION ALL
SELECT
  'test_questions' as tabla,
  COUNT(*) as registros,
  MIN(created_at) as primer_registro,
  MAX(created_at) as ultimo_registro
FROM test_questions;

-- 4. Ver si user_question_history tiene el usuario EM
SELECT
  uqh.*
FROM user_question_history uqh
JOIN user_profiles up ON up.id = uqh.user_id
LEFT JOIN public_user_profiles pup ON pup.id = up.id
WHERE pup.ciudad = 'Palencia'
  AND pup.display_name = 'EM'
ORDER BY uqh.created_at DESC
LIMIT 10;

-- 5. Contar cuántas preguntas tiene EM en user_question_history vs test_questions
WITH em_user AS (
  SELECT up.id
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE pup.ciudad = 'Palencia'
    AND pup.display_name = 'EM'
  LIMIT 1
)
SELECT
  'user_question_history' as tabla,
  COUNT(*) as total_preguntas
FROM user_question_history
WHERE user_id = (SELECT id FROM em_user)
UNION ALL
SELECT
  'test_questions' as tabla,
  COUNT(*) as total_preguntas
FROM test_questions tq
JOIN tests t ON t.id = tq.test_id
WHERE t.user_id = (SELECT id FROM em_user);

-- 6. Ver la relación entre las tablas
SELECT
  tc.table_name as tabla_origen,
  kcu.column_name as columna,
  ccu.table_name as tabla_destino
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('user_question_history', 'test_questions', 'user_learning_analytics')
ORDER BY tc.table_name;