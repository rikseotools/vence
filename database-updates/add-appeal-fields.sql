-- Agregar campos para sistema de alegaciones en impugnaciones
-- Ejecutar en la base de datos de Supabase

-- Agregar columnas para alegaciones
ALTER TABLE question_disputes 
ADD COLUMN IF NOT EXISTS appeal_text TEXT,
ADD COLUMN IF NOT EXISTS appeal_submitted_at TIMESTAMP WITH TIME ZONE;

-- Agregar comentarios para documentar los campos
COMMENT ON COLUMN question_disputes.appeal_text IS 'Texto de la alegación del usuario cuando contesta una impugnación rechazada';
COMMENT ON COLUMN question_disputes.appeal_submitted_at IS 'Fecha y hora cuando el usuario envió la alegación';

-- Crear índice para consultas eficientes de alegaciones
CREATE INDEX IF NOT EXISTS idx_question_disputes_appeal_submitted 
ON question_disputes(appeal_submitted_at) 
WHERE appeal_text IS NOT NULL;

-- Verificar que los cambios se aplicaron correctamente
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'question_disputes' 
AND column_name IN ('appeal_text', 'appeal_submitted_at');