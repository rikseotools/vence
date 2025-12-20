-- Verificar las últimas 9 preguntas guardadas para el usuario
-- =====================================================

-- 1. Ver los tests más recientes del usuario
SELECT 
    t.id as test_id,
    t.test_type,
    t.created_at,
    t.completed_at,
    t.is_completed,
    COUNT(tq.id) as questions_saved
FROM tests t
LEFT JOIN test_questions tq ON t.id = tq.test_id
WHERE t.user_id = (SELECT id FROM auth.users WHERE email = 'ilovetestpro@gmail.com')
AND t.created_at >= NOW() - INTERVAL '2 hours'
GROUP BY t.id, t.test_type, t.created_at, t.completed_at, t.is_completed
ORDER BY t.created_at DESC
LIMIT 5;

-- 2. Ver las preguntas específicas del test más reciente
SELECT 
    tq.id,
    tq.test_id,
    tq.question_order,
    tq.question_text,
    tq.user_answer,
    tq.correct_answer,
    tq.is_correct,
    tq.created_at,
    tq.question_id
FROM test_questions tq
JOIN tests t ON t.id = tq.test_id
WHERE t.user_id = (SELECT id FROM auth.users WHERE email = 'ilovetestpro@gmail.com')
AND t.created_at >= NOW() - INTERVAL '2 hours'
ORDER BY tq.test_id DESC, tq.question_order ASC
LIMIT 15;

-- 3. Verificar estadísticas actuales del usuario
SELECT 
    'Current Stats' as info,
    COUNT(*) as total_questions_answered,
    COUNT(CASE WHEN tq.created_at >= DATE_TRUNC('week', NOW()) THEN 1 END) as this_week_questions
FROM test_questions tq
JOIN tests t ON t.id = tq.test_id
WHERE t.user_id = (SELECT id FROM auth.users WHERE email = 'ilovetestpro@gmail.com')
AND t.is_completed = true;

-- 4. Ver el historial de user_question_history (tabla del trigger)
SELECT 
    COUNT(*) as total_history_records,
    COUNT(CASE WHEN last_attempt_at >= DATE_TRUNC('week', NOW()) THEN 1 END) as this_week_history
FROM user_question_history
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'ilovetestpro@gmail.com');

-- 5. Comparar conteos antes/después del último test
WITH user_stats AS (
    SELECT id as user_id FROM auth.users WHERE email = 'ilovetestpro@gmail.com'
),
recent_test AS (
    SELECT id, created_at 
    FROM tests t, user_stats u
    WHERE t.user_id = u.user_id
    AND t.created_at >= NOW() - INTERVAL '2 hours'
    ORDER BY created_at DESC
    LIMIT 1
),
before_test AS (
    SELECT COUNT(*) as questions_before
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id, user_stats u, recent_test rt
    WHERE t.user_id = u.user_id
    AND tq.created_at < rt.created_at
    AND t.is_completed = true
),
after_test AS (
    SELECT COUNT(*) as questions_after
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id, user_stats u
    WHERE t.user_id = u.user_id
    AND t.is_completed = true
)
SELECT 
    bt.questions_before,
    at.questions_after,
    (at.questions_after - bt.questions_before) as difference,
    'Expected 9 new questions' as expected
FROM before_test bt, after_test at;

-- 6. Ver errores en logs del trigger (si los hay)
SELECT 
    'Checking for trigger errors' as info,
    'Look for any constraint violations or trigger failures in Supabase logs' as note;