-- Consulta para verificar datos de racha del usuario Nila
-- Esta query muestra toda la información de rachas y actividad reciente

-- 1. Información básica del usuario Nila
SELECT 
  id,
  email,
  created_at
FROM auth.users 
WHERE email ILIKE '%nila%' 
LIMIT 5;

-- 2. Actividad reciente de tests (últimos 30 días) para calcular racha
WITH user_nila AS (
  SELECT id FROM auth.users WHERE email ILIKE '%nila%' LIMIT 1
),
recent_activity AS (
  SELECT 
    DATE(ts.created_at) as study_date,
    COUNT(*) as tests_completed,
    ts.user_id
  FROM test_sessions ts
  JOIN user_nila u ON ts.user_id = u.id
  WHERE ts.created_at >= NOW() - INTERVAL '30 days'
    AND ts.completed = true
  GROUP BY DATE(ts.created_at), ts.user_id
  ORDER BY study_date DESC
)
SELECT 
  study_date,
  tests_completed,
  -- Calcular días desde hoy
  (CURRENT_DATE - study_date) as days_ago
FROM recent_activity
ORDER BY study_date DESC;

-- 3. Estadísticas de analytics_daily_user_stats (si existe)
WITH user_nila AS (
  SELECT id FROM auth.users WHERE email ILIKE '%nila%' LIMIT 1
)
SELECT 
  current_streak_days,
  longest_streak_days,
  updated_at,
  total_study_days,
  days_since_last_activity
FROM analytics_daily_user_stats 
WHERE user_id = (SELECT id FROM user_nila)
LIMIT 1;

-- 4. Todas las sesiones de test de Nila (últimos 30 días)
WITH user_nila AS (
  SELECT id FROM auth.users WHERE email ILIKE '%nila%' LIMIT 1
)
SELECT 
  ts.id,
  DATE(ts.created_at) as date,
  ts.created_at,
  ts.completed,
  ts.total_questions,
  ts.correct_answers
FROM test_sessions ts
JOIN user_nila u ON ts.user_id = u.id
WHERE ts.created_at >= NOW() - INTERVAL '30 days'
ORDER BY ts.created_at DESC;