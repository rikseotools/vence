-- Tracking del test de notificación - ANTES y DESPUÉS
-- =====================================================

-- EJECUTAR ANTES DEL TEST
SELECT 
    'BEFORE_TEST' as moment,
    NOW() as timestamp,
    COUNT(*) as total_questions,
    COUNT(CASE WHEN tq.created_at >= DATE_TRUNC('week', NOW()) THEN 1 END) as this_week_questions,
    MAX(tq.created_at) as last_question_time
FROM test_questions tq
JOIN tests t ON t.id = tq.test_id
WHERE t.user_id = (SELECT id FROM auth.users WHERE email = 'ilovetestpro@gmail.com')
AND t.is_completed = true;

-- EJECUTAR DESPUÉS DEL TEST (reemplazar con nueva consulta)
-- SELECT 
--     'AFTER_TEST' as moment,
--     NOW() as timestamp,
--     COUNT(*) as total_questions,
--     COUNT(CASE WHEN tq.created_at >= DATE_TRUNC('week', NOW()) THEN 1 END) as this_week_questions,
--     COUNT(CASE WHEN tq.created_at >= NOW() - INTERVAL '5 minutes' THEN 1 END) as last_5_min_questions
-- FROM test_questions tq
-- JOIN tests t ON t.id = tq.test_id
-- WHERE t.user_id = (SELECT id FROM auth.users WHERE email = 'ilovetestpro@gmail.com')
-- AND t.is_completed = true;