-- Migración: Añadir campos de verificación a nivel de pregunta
-- Fecha: 2025-12-19
-- Propósito: Permitir tracking de verificación individual de preguntas
--            para detectar preguntas nuevas sin verificar en artículos ya revisados

-- Añadir campos a la tabla questions
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS verification_status TEXT NULL;

-- Comentarios descriptivos
COMMENT ON COLUMN questions.verified_at IS 'Fecha/hora de la última verificación con IA';
COMMENT ON COLUMN questions.verification_status IS 'Estado de verificación: ok, problem, pending';

-- Índice para queries eficientes de preguntas sin verificar
CREATE INDEX IF NOT EXISTS idx_questions_verified_at
ON questions(verified_at)
WHERE verified_at IS NULL;

-- Índice para filtrar por status de verificación
CREATE INDEX IF NOT EXISTS idx_questions_verification_status
ON questions(verification_status)
WHERE verification_status IS NOT NULL;

-- Verificar que se crearon correctamente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'verified_at'
  ) THEN
    RAISE NOTICE '✅ Campo verified_at añadido correctamente';
  ELSE
    RAISE EXCEPTION '❌ Error: Campo verified_at no se creó';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'verification_status'
  ) THEN
    RAISE NOTICE '✅ Campo verification_status añadido correctamente';
  ELSE
    RAISE EXCEPTION '❌ Error: Campo verification_status no se creó';
  END IF;
END $$;
