-- Debug: Consultar eventos de email para hoy
-- Ejecutar en Supabase SQL Editor

-- 1. Contar eventos totales de hoy
SELECT 
  event_type,
  COUNT(*) as total_eventos,
  COUNT(DISTINCT user_id) as usuarios_unicos
FROM email_events 
WHERE created_at >= '2025-10-10T00:00:00.000Z' 
  AND created_at <= '2025-10-10T23:59:59.999Z'
GROUP BY event_type
ORDER BY total_eventos DESC;

-- 2. Ver eventos de newsletter específicamente
SELECT 
  event_type,
  email_type,
  campaign_id,
  template_id,
  subject,
  user_id,
  email_address,
  created_at
FROM email_events 
WHERE created_at >= '2025-10-10T00:00:00.000Z' 
  AND created_at <= '2025-10-10T23:59:59.999Z'
  AND (email_type = 'newsletter' OR campaign_id IS NOT NULL)
ORDER BY created_at DESC;

-- 3. Contar todos los eventos de hoy (sin filtros)
SELECT COUNT(*) as total_eventos_hoy
FROM email_events 
WHERE created_at >= '2025-10-10T00:00:00.000Z' 
  AND created_at <= '2025-10-10T23:59:59.999Z';