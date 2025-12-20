-- Verificar si el 10 oct solo se enviaron emails de modal_articulos
SELECT 
  DATE(created_at) as fecha,
  template_id,
  email_type,
  event_type,
  COUNT(*) as total_eventos,
  COUNT(DISTINCT user_id) as usuarios_unicos
FROM email_events 
WHERE created_at >= '2025-10-10 00:00:00' 
  AND created_at < '2025-10-11 00:00:00'
GROUP BY DATE(created_at), template_id, email_type, event_type
ORDER BY template_id, event_type;

-- Verificar específicamente modal_articulos
SELECT 
  event_type,
  COUNT(*) as total_eventos,
  COUNT(DISTINCT user_id) as usuarios_unicos
FROM email_events 
WHERE created_at >= '2025-10-10 00:00:00' 
  AND created_at < '2025-10-11 00:00:00'
  AND template_id = 'modal_articulos'
GROUP BY event_type
ORDER BY event_type;
