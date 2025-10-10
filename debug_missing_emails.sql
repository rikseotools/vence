-- Verificar qué tipos de email existen realmente en la base de datos
SELECT DISTINCT 
  email_type,
  template_id,
  COUNT(*) as total_eventos,
  MIN(created_at) as primer_evento,
  MAX(created_at) as ultimo_evento
FROM email_events 
WHERE created_at >= '2025-10-01 00:00:00'
GROUP BY email_type, template_id
ORDER BY total_eventos DESC;

-- Buscar específicamente emails de motivation y bienvenida
SELECT 
  email_type,
  event_type,
  subject,
  created_at,
  user_id,
  campaign_id
FROM email_events 
WHERE email_type IN ('motivation', 'bienvenida_inmediato', 'bienvenida_motivacional')
  AND created_at >= '2025-10-01 00:00:00'
ORDER BY created_at DESC
LIMIT 10;
