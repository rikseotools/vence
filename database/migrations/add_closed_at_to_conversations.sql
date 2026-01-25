-- Añadir campo closed_at a feedback_conversations
-- Ejecutar en Supabase SQL Editor

-- 1. Añadir columna closed_at
ALTER TABLE feedback_conversations
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- 2. Actualizar conversaciones cerradas existentes con la fecha de last_message_at
UPDATE feedback_conversations
SET closed_at = last_message_at
WHERE status = 'closed' AND closed_at IS NULL;

-- 3. Crear índice para búsquedas por estado
CREATE INDEX IF NOT EXISTS idx_feedback_conversations_status
ON feedback_conversations(status);

-- 4. Comentario
COMMENT ON COLUMN feedback_conversations.closed_at IS 'Fecha y hora en que se cerró la conversación';
