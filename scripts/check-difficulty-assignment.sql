-- ============================================
-- VERIFICAR CÓMO SE ASIGNAN LAS DIFICULTADES
-- ============================================

-- 1. Ver la estructura de la columna difficulty en questions
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'questions'
AND column_name = 'difficulty';

-- 2. Ver distribución actual de dificultades
SELECT
  difficulty,
  COUNT(*) as total_preguntas,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as porcentaje
FROM questions
GROUP BY difficulty
ORDER BY
  CASE difficulty
    WHEN 'easy' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'hard' THEN 3
    WHEN 'extreme' THEN 4
    ELSE 5
  END;

-- 3. Ver ejemplos de preguntas con cada dificultad
SELECT
  difficulty,
  id,
  LEFT(question_text, 80) as preview
FROM questions
WHERE difficulty IS NOT NULL
ORDER BY difficulty, RANDOM()
LIMIT 10;

-- 4. Ver si hay preguntas sin dificultad asignada
SELECT
  COUNT(*) as preguntas_sin_dificultad
FROM questions
WHERE difficulty IS NULL;
