-- Verificar eventos específicos de modal_articulos
SELECT 
  template_id,
  email_type,
  event_type,
  COUNT(*) as count,
  MAX(created_at) as last_event
FROM email_events 
WHERE template_id = 'modal_articulos'
GROUP BY template_id, email_type, event_type
ORDER BY last_event DESC;

-- Ver todos los template_ids únicos
SELECT 
  DISTINCT template_id,
  COUNT(*) as total_events
FROM email_events 
GROUP BY template_id
ORDER BY total_events DESC;