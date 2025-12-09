-- =====================================================
-- VERIFICAR DIFICULTAD DEL TEMA 9
-- =====================================================

-- 1. Ver cuántas preguntas del Tema 9 tienen global_difficulty vs difficulty estática
WITH tema9_questions AS (
  SELECT
    q.id,
    q.difficulty as difficulty_estatica,
    q.global_difficulty,
    q.difficulty_sample_size,
    q.difficulty_confidence,
    a.article_number,
    l.short_name as law_name
  FROM questions q
  INNER JOIN articles a ON q.article_id = a.id
  INNER JOIN laws l ON a.law_id = l.id
  WHERE q.is_active = true
  AND l.short_name IN ('Ley 39/2015', 'Ley 40/2015')
  AND a.article_number IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100)
)
SELECT
  'Total preguntas Tema 9' as metrica,
  COUNT(*) as total
FROM tema9_questions
UNION ALL
SELECT
  'Con global_difficulty (calculada)' as metrica,
  COUNT(*) as total
FROM tema9_questions
WHERE global_difficulty IS NOT NULL
UNION ALL
SELECT
  'Sin global_difficulty (usan estatica)' as metrica,
  COUNT(*) as total
FROM tema9_questions
WHERE global_difficulty IS NULL;

-- 2. Ver distribución de dificultad CALCULADA (global_difficulty) del Tema 9
SELECT
  'Distribucion CALCULADA (global_difficulty)' as tipo,
  CASE
    WHEN global_difficulty < 25 THEN 'easy'
    WHEN global_difficulty < 50 THEN 'medium'
    WHEN global_difficulty < 75 THEN 'hard'
    ELSE 'extreme'
  END as difficulty_level,
  COUNT(*) as total,
  ROUND(AVG(difficulty_sample_size), 0) as avg_samples
FROM questions q
INNER JOIN articles a ON q.article_id = a.id
INNER JOIN laws l ON a.law_id = l.id
WHERE q.is_active = true
AND l.short_name IN ('Ley 39/2015', 'Ley 40/2015')
AND a.article_number <= 100
AND q.global_difficulty IS NOT NULL
GROUP BY
  CASE
    WHEN global_difficulty < 25 THEN 'easy'
    WHEN global_difficulty < 50 THEN 'medium'
    WHEN global_difficulty < 75 THEN 'hard'
    ELSE 'extreme'
  END
ORDER BY MIN(global_difficulty);

-- 3. Ver distribución de dificultad ESTÁTICA (difficulty) del Tema 9
SELECT
  'Distribucion ESTATICA (difficulty)' as tipo,
  difficulty as difficulty_level,
  COUNT(*) as total
FROM questions q
INNER JOIN articles a ON q.article_id = a.id
INNER JOIN laws l ON a.law_id = l.id
WHERE q.is_active = true
AND l.short_name IN ('Ley 39/2015', 'Ley 40/2015')
AND a.article_number <= 100
GROUP BY difficulty
ORDER BY
  CASE difficulty
    WHEN 'easy' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'hard' THEN 3
    WHEN 'extreme' THEN 4
  END;

-- 4. Ver distribución MIXTA (lo que realmente se muestra en el frontend)
WITH tema9_mixed AS (
  SELECT
    q.id,
    CASE
      WHEN q.global_difficulty IS NOT NULL THEN
        CASE
          WHEN q.global_difficulty < 25 THEN 'easy'
          WHEN q.global_difficulty < 50 THEN 'medium'
          WHEN q.global_difficulty < 75 THEN 'hard'
          ELSE 'extreme'
        END
      ELSE q.difficulty
    END as final_difficulty,
    CASE
      WHEN q.global_difficulty IS NOT NULL THEN 'calculada'
      ELSE 'estatica'
    END as source
  FROM questions q
  INNER JOIN articles a ON q.article_id = a.id
  INNER JOIN laws l ON a.law_id = l.id
  WHERE q.is_active = true
  AND l.short_name IN ('Ley 39/2015', 'Ley 40/2015')
  AND a.article_number <= 100
)
SELECT
  'Distribucion MIXTA (frontend)' as tipo,
  final_difficulty,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as porcentaje,
  SUM(CASE WHEN source = 'calculada' THEN 1 ELSE 0 END) as calculadas,
  SUM(CASE WHEN source = 'estatica' THEN 1 ELSE 0 END) as estaticas
FROM tema9_mixed
GROUP BY final_difficulty
ORDER BY
  CASE final_difficulty
    WHEN 'easy' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'hard' THEN 3
    WHEN 'extreme' THEN 4
  END;

-- 5. Verificar que el mapping de artículos es correcto para Tema 9
SELECT
  'Verificacion mapping Tema 9' as check_name,
  l.short_name,
  COUNT(DISTINCT a.article_number) as articulos_unicos,
  MIN(a.article_number) as min_articulo,
  MAX(a.article_number) as max_articulo
FROM articles a
INNER JOIN laws l ON a.law_id = l.id
WHERE l.short_name IN ('Ley 39/2015', 'Ley 40/2015')
AND a.article_number <= 100
GROUP BY l.short_name;
