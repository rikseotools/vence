-- Verificar diferencia entre email_logs y email_events
SELECT 'email_logs' as tabla, email_type, COUNT(*) as total
FROM email_logs 
WHERE created_at >= '2025-10-01 00:00:00'
GROUP BY email_type

UNION ALL

SELECT 'email_events' as tabla, email_type, COUNT(*) as total  
FROM email_events
WHERE created_at >= '2025-10-01 00:00:00'
GROUP BY email_type

ORDER BY tabla, email_type;

-- Buscar específicamente bienvenida en ambas tablas
SELECT 'email_logs' as tabla, email_type, template_id, subject, COUNT(*) as total
FROM email_logs 
WHERE email_type LIKE '%bienvenida%' 
   OR template_id LIKE '%welcome%'
   OR subject LIKE '%bienvenida%'
   AND created_at >= '2025-10-01 00:00:00'
GROUP BY email_type, template_id, subject

UNION ALL

SELECT 'email_events' as tabla, email_type, template_id, subject, COUNT(*) as total
FROM email_events 
WHERE email_type LIKE '%bienvenida%' 
   OR template_id LIKE '%welcome%'
   OR subject LIKE '%bienvenida%'
   AND created_at >= '2025-10-01 00:00:00'
GROUP BY email_type, template_id, subject;
