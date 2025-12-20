-- Análisis individual de usuarios - ver patrones específicos
-- Query para entender comportamiento individual de usuarios

WITH user_sessions AS (
  SELECT 
    tests.user_id,
    DATE(tests.created_at) as session_date,
    COUNT(*) as tests_that_day
  FROM tests 
  WHERE tests.created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY tests.user_id, DATE(tests.created_at)
),
session_gaps AS (
  SELECT 
    user_id,
    session_date,
    tests_that_day,
    LAG(session_date) OVER (PARTITION BY user_id ORDER BY session_date) as prev_session_date,
    session_date - LAG(session_date) OVER (PARTITION BY user_id ORDER BY session_date) as days_gap
  FROM user_sessions
),
user_stats AS (
  SELECT 
    sg.user_id,
    COUNT(*) as total_sessions,
    AVG(sg.days_gap::numeric) as avg_gap,
    MIN(sg.days_gap) as min_gap,
    MAX(sg.days_gap) as max_gap,
    SUM(sg.tests_that_day) as total_tests,
    -- Obtener email del usuario para identificación
    up.email as user_email,
    up.full_name
  FROM session_gaps sg
  LEFT JOIN user_profiles up ON sg.user_id = up.id
  WHERE sg.days_gap IS NOT NULL
  GROUP BY sg.user_id, up.email, up.full_name
  HAVING COUNT(*) >= 2
)
SELECT 
  user_email,
  full_name,
  total_sessions,
  total_tests,
  ROUND(avg_gap, 1) as dias_promedio_entre_sesiones,
  min_gap as minimo_dias_gap,
  max_gap as maximo_dias_gap,
  CASE 
    WHEN avg_gap <= 1.5 THEN 'Diario'
    WHEN avg_gap <= 3 THEN 'Frecuente'  
    WHEN avg_gap <= 7 THEN 'Semanal'
    WHEN avg_gap <= 14 THEN 'Quincenal'
    ELSE 'Esporádico'
  END as patron_clasificacion
FROM user_stats
ORDER BY avg_gap, total_tests DESC
LIMIT 20;