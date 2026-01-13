-- Migración: Añadir question_id a user_feedback
-- Permite rastrear qué pregunta estaba viendo el usuario cuando reportó un bug
-- Fecha: 2026-01-12

-- Añadir columna question_id
ALTER TABLE user_feedback
ADD COLUMN IF NOT EXISTS question_id UUID REFERENCES questions(id);

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_user_feedback_question_id
ON user_feedback(question_id)
WHERE question_id IS NOT NULL;

-- Comentario explicativo
COMMENT ON COLUMN user_feedback.question_id IS 'ID de la pregunta que el usuario estaba viendo cuando creó el feedback (útil para debugging de bugs)';
