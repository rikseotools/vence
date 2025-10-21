-- Agregar campo para trackear cuando el admin vio la conversación
-- Esto reemplaza el sistema de localStorage por un sistema basado en BD

ALTER TABLE feedback_conversations 
ADD COLUMN admin_viewed_at timestamp with time zone;

-- Crear índice para optimizar consultas de conversaciones no vistas
CREATE INDEX idx_feedback_conversations_admin_viewed 
ON feedback_conversations(status, admin_viewed_at) 
WHERE admin_viewed_at IS NULL;

-- Comentario sobre el propósito del campo
COMMENT ON COLUMN feedback_conversations.admin_viewed_at IS 'Timestamp cuando el admin vio la conversación por primera vez. NULL = no vista';