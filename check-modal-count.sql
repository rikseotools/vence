-- Ver todos los eventos de modal_articulos
SELECT 
  template_id,
  event_type,
  COUNT(*) as count,
  MAX(created_at) as last_event
FROM email_events 
WHERE template_id = 'modal_articulos'
GROUP BY template_id, event_type
ORDER BY last_event DESC;