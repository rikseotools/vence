-- ============================================
-- VERIFICAR SISTEMA DE DIFICULTAD ACTUAL
-- ============================================

-- 1. Verificar si existe tabla de primeros intentos para questions normales
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'first_attempts' OR table_name = 'question_first_attempts'
) as tiene_tabla_first_attempts;

-- 2. Verificar columnas de dificultad en tabla questions
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'questions'
AND (column_name LIKE '%difficulty%' OR column_name LIKE '%sample%')
ORDER BY column_name;

-- 3. Verificar si existe función de actualización de dificultad
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name LIKE '%difficulty%'
AND routine_schema = 'public'
ORDER BY routine_name;

-- 4. Verificar si existe trigger automático
SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%difficulty%'
ORDER BY trigger_name;

-- 5. Ver sample de dificultades actuales en questions
SELECT
  difficulty,
  COUNT(*) as total,
  ROUND(AVG(
    CASE
      WHEN difficulty = 'easy' THEN 1
      WHEN difficulty = 'medium' THEN 2
      WHEN difficulty = 'hard' THEN 3
      WHEN difficulty = 'extreme' THEN 4
      ELSE 0
    END
  ), 2) as avg_numeric_difficulty
FROM questions
GROUP BY difficulty;
