-- Verificar estructura de tabla psychometric_questions
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'psychometric_questions' 
ORDER BY ordinal_position;

-- Verificar datos disponibles por categoría
SELECT 
    category_key,
    question_subtype,
    COUNT(*) as question_count
FROM psychometric_questions 
WHERE is_active = true 
GROUP BY category_key, question_subtype 
ORDER BY category_key, question_subtype;

-- Total por categoría
SELECT 
    category_key,
    COUNT(*) as total_questions
FROM psychometric_questions 
WHERE is_active = true 
GROUP BY category_key 
ORDER BY category_key;
