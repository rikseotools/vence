-- Análisis de patrones de conexión de usuarios
-- Query para analizar cada cuánto los usuarios se conectan y hacen tests

WITH user_sessions AS (
  SELECT 
    tests.user_id,
    DATE(tests.created_at) as session_date,
    MIN(tests.created_at) as first_test_of_day,
    COUNT(*) as tests_count
  FROM tests 
  WHERE tests.created_at >= CURRENT_DATE - INTERVAL '60 days'
  GROUP BY tests.user_id, DATE(tests.created_at)
),
session_gaps AS (
  SELECT 
    user_id,
    session_date,
    tests_count,
    LAG(session_date) OVER (PARTITION BY user_id ORDER BY session_date) as prev_session_date,
    session_date - LAG(session_date) OVER (PARTITION BY user_id ORDER BY session_date) as days_gap
  FROM user_sessions
),
user_patterns AS (
  SELECT 
    user_id,
    COUNT(*) as total_sessions,
    AVG(days_gap::numeric) as avg_days_between_sessions,
    MIN(days_gap) as min_gap,
    MAX(days_gap) as max_gap,
    STDDEV(days_gap::numeric) as stddev_gap,
    SUM(tests_count) as total_tests
  FROM session_gaps 
  WHERE days_gap IS NOT NULL
  GROUP BY user_id
  HAVING COUNT(*) >= 2
)
SELECT 
  CASE 
    WHEN avg_days_between_sessions <= 1.5 THEN 'Diario (≤1.5 días)'
    WHEN avg_days_between_sessions <= 3 THEN 'Frecuente (2-3 días)'  
    WHEN avg_days_between_sessions <= 7 THEN 'Semanal (4-7 días)'
    WHEN avg_days_between_sessions <= 14 THEN 'Quincenal (8-14 días)'
    ELSE 'Esporádico (>14 días)'
  END as patron_uso,
  COUNT(*) as num_usuarios,
  ROUND(AVG(avg_days_between_sessions), 1) as promedio_dias_entre_sesiones,
  ROUND(AVG(total_sessions), 1) as promedio_sesiones_por_usuario,
  ROUND(AVG(total_tests), 1) as promedio_tests_por_usuario
FROM user_patterns
GROUP BY 
  CASE 
    WHEN avg_days_between_sessions <= 1.5 THEN 'Diario (≤1.5 días)'
    WHEN avg_days_between_sessions <= 3 THEN 'Frecuente (2-3 días)'  
    WHEN avg_days_between_sessions <= 7 THEN 'Semanal (4-7 días)'
    WHEN avg_days_between_sessions <= 14 THEN 'Quincenal (8-14 días)'
    ELSE 'Esporádico (>14 días)'
  END
ORDER BY AVG(avg_days_between_sessions);