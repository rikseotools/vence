-- Buscar emails individuales en los últimos 30 días
SELECT 
  email_type,
  COUNT(*) as total_eventos,
  COUNT(DISTINCT user_id) as usuarios_unicos,
  MIN(created_at) as primer_evento,
  MAX(created_at) as ultimo_evento
FROM email_events 
WHERE email_type IN ('reactivacion', 'urgente', 'bienvenida_inmediato', 'bienvenida_motivacional')
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY email_type
ORDER BY ultimo_evento DESC;

-- Verificar si hay emails individuales recientes
SELECT 
  email_type,
  event_type,
  subject,
  created_at,
  user_id
FROM email_events 
WHERE email_type IN ('reactivacion', 'urgente', 'bienvenida_inmediato', 'bienvenida_motivacional')
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 20;
