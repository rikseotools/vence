-- Ver los últimos 5 eventos de cualquier tipo
SELECT 
  template_id,
  email_type,
  event_type,
  email_address,
  created_at
FROM email_events 
ORDER BY created_at DESC 
LIMIT 5;