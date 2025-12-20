-- Eliminar eventos de prueba y debugging
-- IMPORTANTE: Ejecutar con cuidado, esto elimina datos permanentemente

-- 1. Ver primero qué eventos vamos a eliminar (para confirmar)
SELECT 
  template_id,
  email_type,
  event_type,
  email_address,
  subject,
  created_at
FROM email_events 
WHERE 
  -- Eventos de testing con email desconocido
  email_address = 'unknown@tracking.vence.es'
  OR 
  -- Eventos con subject de testing
  subject LIKE '%Email Tracking%'
  OR
  subject LIKE '%Newsletter Opened%'
  OR
  subject LIKE '%Newsletter Link Clicked%'
ORDER BY created_at DESC;

-- 2. ELIMINAR los eventos de prueba (DESCOMENTA SOLO DESPUÉS DE VERIFICAR ARRIBA)
/*
DELETE FROM email_events 
WHERE 
  -- Eventos de testing con email desconocido
  email_address = 'unknown@tracking.vence.es'
  OR 
  -- Eventos con subject de testing
  subject LIKE '%Email Tracking%'
  OR
  subject LIKE '%Newsletter Opened%'
  OR
  subject LIKE '%Newsletter Link Clicked%';
*/

-- 3. Ver estadísticas limpias después del cleanup
SELECT 
  template_id,
  event_type,
  COUNT(*) as count
FROM email_events 
WHERE template_id = 'modal_articulos'
GROUP BY template_id, event_type
ORDER BY event_type;