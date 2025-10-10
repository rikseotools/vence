-- Revisar todos los tipos de email que existen en el sistema
SELECT DISTINCT 
  email_type,
  template_id,
  COUNT(*) as total_eventos,
  COUNT(DISTINCT campaign_id) as total_campaigns,
  COUNT(DISTINCT user_id) as usuarios_unicos,
  MIN(created_at) as primer_evento,
  MAX(created_at) as ultimo_evento
FROM email_events 
WHERE created_at >= '2025-09-01 00:00:00'
GROUP BY email_type, template_id
ORDER BY total_eventos DESC;
