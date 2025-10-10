-- Verificar el último email enviado a manueltrader@gmail.com
SELECT 
  template_id,
  email_type,
  subject,
  event_type,
  created_at,
  email_address
FROM email_events 
WHERE email_address = 'manueltrader@gmail.com'
ORDER BY created_at DESC 
LIMIT 10;

-- Ver todos los templates/tipos de email recientes
SELECT 
  COALESCE(template_id, email_type, 'sin_tipo') as template,
  COUNT(*) as total_events,
  MAX(created_at) as last_event
FROM email_events 
WHERE created_at >= NOW() - INTERVAL '1 day'
GROUP BY template_id, email_type
ORDER BY last_event DESC;