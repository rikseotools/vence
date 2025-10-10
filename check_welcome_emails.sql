-- Verificar todos los tipos de email que existen
SELECT DISTINCT 
  email_type,
  template_id,
  COUNT(*) as total_eventos,
  COUNT(DISTINCT campaign_id) as total_campaigns,
  COUNT(DISTINCT user_id) as usuarios_unicos,
  MIN(created_at) as primer_evento,
  MAX(created_at) as ultimo_evento
FROM email_events 
WHERE created_at >= '2025-10-01 00:00:00'
GROUP BY email_type, template_id
ORDER BY total_eventos DESC;

-- Buscar específicamente emails de bienvenida
SELECT 
  email_type,
  template_id,
  campaign_id,
  subject,
  event_type,
  COUNT(*) as eventos
FROM email_events 
WHERE (email_type LIKE '%welcome%' OR email_type LIKE '%bienvenida%' OR template_id LIKE '%welcome%')
  AND created_at >= '2025-10-01 00:00:00'
GROUP BY email_type, template_id, campaign_id, subject, event_type
ORDER BY campaign_id, event_type;
