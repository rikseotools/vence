-- Monitor para verificar que las mejoras anti-spam funcionan
-- Ejecutar diariamente para verificar el comportamiento

-- 1. 📊 VOLUMEN DIARIO (debería ser máximo 1/7 de usuarios activos)
SELECT 
  DATE(created_at) as fecha,
  COUNT(*) as emails_enviados,
  COUNT(DISTINCT user_email) as usuarios_unicos
FROM email_events 
WHERE email_type = 'motivational' 
  AND event_type = 'sent'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY fecha DESC;

-- 2. 🛡️ VERIFICAR LÍMITES POR USUARIO (nadie debería tener >1 por semana)
SELECT 
  user_email,
  COUNT(*) as emails_esta_semana,
  MAX(created_at) as ultimo_email
FROM email_events 
WHERE email_type = 'motivational' 
  AND event_type = 'sent'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY user_email
HAVING COUNT(*) > 1  -- 🚨 Estos usuarios violaron el límite
ORDER BY emails_esta_semana DESC;

-- 3. 🎨 VERIFICAR VARIEDAD DE TEMPLATES (no debería haber repetición)
SELECT 
  subject,
  COUNT(*) as veces_usado,
  ARRAY_AGG(DISTINCT user_email) as usuarios
FROM email_events 
WHERE email_type = 'motivational' 
  AND event_type = 'sent'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY subject
ORDER BY veces_usado DESC;

-- 4. ⏰ VERIFICAR COOLDOWN (7 días mínimo entre emails por usuario)
WITH user_email_intervals AS (
  SELECT 
    user_email,
    created_at,
    LAG(created_at) OVER (PARTITION BY user_email ORDER BY created_at) as email_anterior,
    EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY user_email ORDER BY created_at)))/86400 as dias_diferencia
  FROM email_events 
  WHERE email_type = 'motivational' 
    AND event_type = 'sent'
    AND created_at >= NOW() - INTERVAL '30 days'
)
SELECT 
  user_email,
  dias_diferencia,
  created_at as ultimo_email,
  email_anterior
FROM user_email_intervals 
WHERE dias_diferencia < 7  -- 🚨 Estos violaron el cooldown
ORDER BY dias_diferencia ASC;

-- 5. 📈 COMPARACIÓN ANTES/DESPUÉS (últimos 30 días vs 30 días anteriores)
SELECT 
  'Últimos 30 días' as periodo,
  COUNT(*) as total_emails,
  COUNT(*) / 30.0 as promedio_diario,
  COUNT(DISTINCT user_email) as usuarios_únicos
FROM email_events 
WHERE email_type = 'motivational' 
  AND event_type = 'sent'
  AND created_at >= NOW() - INTERVAL '30 days'

UNION ALL

SELECT 
  '30 días anteriores' as periodo,
  COUNT(*) as total_emails,
  COUNT(*) / 30.0 as promedio_diario,
  COUNT(DISTINCT user_email) as usuarios_únicos
FROM email_events 
WHERE email_type = 'motivational' 
  AND event_type = 'sent'
  AND created_at >= NOW() - INTERVAL '60 days'
  AND created_at < NOW() - INTERVAL '30 days';