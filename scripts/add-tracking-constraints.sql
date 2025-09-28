-- add-tracking-constraints.sql
-- Añadir constraint único para evitar duplicados en problematic_questions_tracking

-- Crear índice único compuesto para prevenir duplicados por question_id + detection_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_problematic_questions_unique
ON problematic_questions_tracking (question_id, detection_type);