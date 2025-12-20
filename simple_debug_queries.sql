-- Simple Debug Queries for Medal System "Today" Tab Issues
-- Run these queries to quickly identify the problem

-- 1. QUICK CHECK: How many users have activity today?
SELECT 
    COUNT(DISTINCT t.user_id) as users_with_activity_today,
    COUNT(tq.id) as total_questions_today,
    MIN(tq.created_at) as first_activity,
    MAX(tq.created_at) as last_activity
FROM tests t
INNER JOIN test_questions tq ON t.id = tq.test_id
WHERE t.is_completed = true
    AND tq.created_at >= CURRENT_DATE
    AND tq.created_at < CURRENT_DATE + INTERVAL '1 day';

-- 2. CURRENT RANKING FOR TODAY (exactly as RankingModal should calculate)
WITH today_stats AS (
    SELECT 
        t.user_id,
        COUNT(tq.id) as total_questions,
        SUM(CASE WHEN tq.is_correct = true THEN 1 ELSE 0 END) as correct_answers,
        ROUND(
            (SUM(CASE WHEN tq.is_correct = true THEN 1 ELSE 0 END)::DECIMAL / COUNT(tq.id)) * 100, 
            0
        ) as accuracy
    FROM tests t
    INNER JOIN test_questions tq ON t.id = tq.test_id
    WHERE t.is_completed = true
        AND tq.created_at >= CURRENT_DATE  -- This matches RankingModal logic
    GROUP BY t.user_id
    HAVING COUNT(tq.id) >= 5  -- Minimum 5 questions
)
SELECT 
    ROW_NUMBER() OVER (ORDER BY accuracy DESC, total_questions DESC) as rank,
    user_id,
    total_questions,
    correct_answers,
    accuracy,
    p.display_name
FROM today_stats ts
LEFT JOIN public_user_profiles p ON ts.user_id = p.id
ORDER BY accuracy DESC, total_questions DESC
LIMIT 10;

-- 3. CHECK FOR COMMON DATA ISSUES
SELECT 
    'Incomplete tests today' as issue,
    COUNT(*) as count
FROM tests t
WHERE t.created_at >= CURRENT_DATE
    AND t.is_completed = false

UNION ALL

SELECT 
    'Questions without completed tests today' as issue,
    COUNT(*) as count
FROM test_questions tq
LEFT JOIN tests t ON tq.test_id = t.id
WHERE tq.created_at >= CURRENT_DATE
    AND (t.id IS NULL OR t.is_completed = false)

UNION ALL

SELECT 
    'Users without profiles in ranking' as issue,
    COUNT(*) as count
FROM (
    SELECT DISTINCT t.user_id
    FROM tests t
    INNER JOIN test_questions tq ON t.id = tq.test_id
    WHERE t.is_completed = true
        AND tq.created_at >= CURRENT_DATE
    GROUP BY t.user_id
    HAVING COUNT(tq.id) >= 5
) active_users
LEFT JOIN public_user_profiles p ON active_users.user_id = p.id
WHERE p.id IS NULL;

-- 4. TIME ZONE CHECK
SELECT 
    NOW() as utc_now,
    NOW() AT TIME ZONE 'Europe/Madrid' as madrid_time,
    CURRENT_DATE as current_date,
    EXTRACT(hour FROM NOW()) as current_utc_hour;

-- 5. RECENT ACTIVITY PATTERN (to see if data is actually being created)
SELECT 
    DATE_TRUNC('hour', tq.created_at) as hour_bucket,
    COUNT(tq.id) as questions,
    COUNT(DISTINCT t.user_id) as users
FROM tests t
INNER JOIN test_questions tq ON t.id = tq.test_id
WHERE t.is_completed = true
    AND tq.created_at >= NOW() - INTERVAL '6 hours'
GROUP BY DATE_TRUNC('hour', tq.created_at)
ORDER BY hour_bucket DESC;