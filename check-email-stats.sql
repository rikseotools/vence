-- Consulta para verificar estadísticas reales de emails por template

-- 1. Ver cuántos usuarios activos hay
SELECT 
  'Total usuarios' as metric,
  COUNT(*) as count
FROM user_profiles 
WHERE created_at IS NOT NULL;

-- 2. Ver todos los eventos de email que existen
SELECT 
  'Total eventos email' as metric,
  COUNT(*) as count
FROM email_events;

-- 3. Ver eventos por tipo de template/email
SELECT 
  COALESCE(template_id, email_type, 'sin_tipo') as template,
  event_type,
  COUNT(*) as count
FROM email_events 
GROUP BY template_id, email_type, event_type
ORDER BY template, event_type;

-- 4. Ver estadísticas detalladas por template
SELECT 
  COALESCE(template_id, email_type, 'sin_tipo') as template,
  COUNT(CASE WHEN event_type = 'sent' THEN 1 END) as total_sent,
  COUNT(CASE WHEN event_type = 'delivered' THEN 1 END) as total_delivered,
  COUNT(DISTINCT CASE WHEN event_type = 'opened' THEN user_id END) as unique_opens,
  COUNT(DISTINCT CASE WHEN event_type = 'clicked' THEN user_id END) as unique_clicks,
  COUNT(CASE WHEN event_type = 'bounced' THEN 1 END) as total_bounced,
  MAX(CASE WHEN event_type = 'sent' THEN created_at END) as last_sent,
  MAX(CASE WHEN event_type = 'sent' THEN subject END) as last_subject
FROM email_events 
GROUP BY COALESCE(template_id, email_type, 'sin_tipo')
HAVING COUNT(CASE WHEN event_type = 'sent' THEN 1 END) > 0
ORDER BY total_sent DESC;

-- 5. Ver distribución temporal de envíos (últimos 90 días)
SELECT 
  DATE(created_at) as date,
  COALESCE(template_id, email_type, 'sin_tipo') as template,
  COUNT(*) as events
FROM email_events 
WHERE created_at >= NOW() - INTERVAL '90 days'
  AND event_type = 'sent'
GROUP BY DATE(created_at), COALESCE(template_id, email_type, 'sin_tipo')
ORDER BY date DESC, events DESC;