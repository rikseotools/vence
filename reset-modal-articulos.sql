-- Limpiar TODOS los eventos de modal_articulos para empezar desde cero en producción

-- 1. Ver primero todos los eventos que vamos a eliminar
SELECT 
  template_id,
  email_type,
  event_type,
  email_address,
  subject,
  created_at
FROM email_events 
WHERE template_id = 'modal_articulos'
ORDER BY created_at DESC;

-- 2. ELIMINAR todos los eventos de modal_articulos (DESCOMENTA DESPUÉS DE VERIFICAR)
/*
DELETE FROM email_events 
WHERE template_id = 'modal_articulos';
*/

-- 3. Verificar que se eliminaron
SELECT 
  template_id,
  event_type,
  COUNT(*) as count
FROM email_events 
WHERE template_id = 'modal_articulos'
GROUP BY template_id, event_type;