-- Investigar por qué Javi perdió la racha
-- Query para ejecutar manualmente en Supabase

-- 1. Ver actividad reciente de usuarios clave
WITH user_activity AS (
  SELECT 
    t.user_id,
    DATE(tq.created_at) as activity_date,
    tq.created_at,
    COUNT(*) as questions_answered
  FROM test_questions tq
  JOIN tests t ON tq.test_id = t.id
  WHERE tq.created_at >= NOW() - INTERVAL '7 days'
  GROUP BY t.user_id, DATE(tq.created_at), tq.created_at
  ORDER BY tq.created_at DESC
),
user_names AS (
  SELECT 
    up.id,
    COALESCE(
      up.display_name, 
      SPLIT_PART(au.email, '@', 1),
      'Usuario'
    ) as name
  FROM user_profiles up
  LEFT JOIN admin_users_with_roles au ON up.id = au.user_id
)
SELECT 
  un.name,
  ua.activity_date,
  ua.created_at as last_activity,
  ua.questions_answered,
  -- Verificar si es hoy o ayer
  CASE 
    WHEN ua.activity_date = DATE(NOW()) THEN '✅ HOY'
    WHEN ua.activity_date = DATE(NOW() - INTERVAL '1 day') THEN '⚠️ AYER'
    ELSE '❌ ANTERIOR'
  END as status
FROM user_activity ua
JOIN user_names un ON ua.user_id = un.id
WHERE LOWER(un.name) LIKE '%javi%' 
   OR LOWER(un.name) LIKE '%nila%' 
   OR LOWER(un.name) LIKE '%ismael%'
ORDER BY un.name, ua.activity_date DESC;

-- 2. Query para verificar rachas exactas (copiar y pegar por separado)
WITH user_streak_data AS (
  SELECT 
    t.user_id,
    un.name,
    ARRAY_AGG(DISTINCT DATE(tq.created_at) ORDER BY DATE(tq.created_at) DESC) as activity_dates,
    COUNT(DISTINCT DATE(tq.created_at)) as total_active_days
  FROM test_questions tq
  JOIN tests t ON tq.test_id = t.id
  JOIN (
    SELECT 
      up.id,
      COALESCE(up.display_name, SPLIT_PART(au.email, '@', 1), 'Usuario') as name
    FROM user_profiles up
    LEFT JOIN admin_users_with_roles au ON up.id = au.user_id
  ) un ON t.user_id = un.id
  WHERE tq.created_at >= NOW() - INTERVAL '35 days'
    AND (LOWER(un.name) LIKE '%javi%' 
         OR LOWER(un.name) LIKE '%nila%' 
         OR LOWER(un.name) LIKE '%ismael%')
  GROUP BY t.user_id, un.name
)
SELECT 
  name,
  total_active_days,
  activity_dates[1:5] as recent_5_days,
  -- Verificar si tiene actividad hoy o ayer
  CASE 
    WHEN DATE(NOW()) = ANY(activity_dates) THEN 'Activo HOY'
    WHEN DATE(NOW() - INTERVAL '1 day') = ANY(activity_dates) THEN 'Activo AYER'
    ELSE 'Sin actividad reciente'
  END as recent_status,
  -- Días desde última actividad
  DATE(NOW()) - activity_dates[1] as dias_desde_ultima_actividad
FROM user_streak_data
ORDER BY total_active_days DESC;