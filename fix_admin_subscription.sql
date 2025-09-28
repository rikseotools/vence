-- Script para re-suscribir al usuario admin de emails
-- El admin user ID es: b9ebbad0-cb6d-4dc3-87fc-a32a31611256

-- Opción 1: Actualizar el registro existente para marcarlo como suscrito
UPDATE email_preferences 
SET unsubscribed_all = false,
    updated_at = NOW()
WHERE user_id = 'b9ebbad0-cb6d-4dc3-87fc-a32a31611256';

-- Alternativamente, si prefieres eliminar completamente el registro:
-- (los usuarios sin registro en email_preferences están suscritos por defecto)
-- DELETE FROM email_preferences WHERE user_id = 'b9ebbad0-cb6d-4dc3-87fc-a32a31611256';

-- Verificar el cambio
SELECT user_id, unsubscribed_all, unsubscribed_motivation, unsubscribed_achievement, updated_at
FROM email_preferences 
WHERE user_id = 'b9ebbad0-cb6d-4dc3-87fc-a32a31611256';