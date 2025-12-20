-- Verificar estructura de tabla psychometric_questions
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'psychometric_questions' 
ORDER BY ordinal_position;

-- Verificar datos disponibles por categoría
SELECT 
    category_id,
    question_subtype,
    COUNT(*) as question_count
FROM psychometric_questions 
WHERE is_active = true 
GROUP BY category_id, question_subtype 
ORDER BY category_id, question_subtype;

-- Total por categoría
SELECT 
    category_id,
    COUNT(*) as total_questions
FROM psychometric_questions 
WHERE is_active = true 
GROUP BY category_id 
ORDER BY category_id;
