SELECT 
  template_id,
  email_type,
  event_type,
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_users
FROM email_events 
WHERE created_at >= '2025-10-10 00:00:00' 
  AND created_at < '2025-10-11 00:00:00'
GROUP BY template_id, email_type, event_type
ORDER BY template_id, event_type;
