-- Ver los eventos más recientes
SELECT 
  template_id,
  email_type,
  event_type,
  email_address,
  created_at
FROM email_events 
ORDER BY created_at DESC 
LIMIT 10;

-- Ver específicamente eventos de modal_articulos
SELECT 
  template_id,
  event_type,
  COUNT(*) as count
FROM email_events 
WHERE template_id = 'modal_articulos'
GROUP BY template_id, event_type;