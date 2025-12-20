-- Ver los question_subtype que existen
SELECT 
    question_subtype,
    COUNT(*) as count
FROM psychometric_questions 
WHERE is_active = true 
GROUP BY question_subtype 
ORDER BY question_subtype;
