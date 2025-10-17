-- Verificar estructura de topics
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'topics' 
ORDER BY ordinal_position;

-- Ver algunos registros de topics
SELECT * FROM topics LIMIT 10;

-- Ver cómo se relaciona tema_number en test_questions con topics
SELECT DISTINCT 
  tq.tema_number,
  COUNT(*) as preguntas_count
FROM test_questions tq
WHERE tq.tema_number IS NOT NULL
GROUP BY tq.tema_number
ORDER BY tq.tema_number;