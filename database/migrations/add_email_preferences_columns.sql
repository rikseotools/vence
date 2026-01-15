-- Migración: Añadir columnas de preferencias de email para soporte y newsletter
-- Fecha: 2026-01-15

-- Añadir columna para emails de soporte (disabled = false significa que SÍ los recibe)
ALTER TABLE email_preferences
ADD COLUMN IF NOT EXISTS email_soporte_disabled boolean DEFAULT false;

-- Añadir columna para emails de newsletter (disabled = false significa que SÍ los recibe)
ALTER TABLE email_preferences
ADD COLUMN IF NOT EXISTS email_newsletter_disabled boolean DEFAULT false;

-- Comentarios para documentación
COMMENT ON COLUMN email_preferences.email_soporte_disabled IS 'Si true, el usuario NO recibe emails de respuestas de soporte e impugnaciones';
COMMENT ON COLUMN email_preferences.email_newsletter_disabled IS 'Si true, el usuario NO recibe emails de newsletter con información de su oposición';
