-- =====================================================
-- MIGRACIÓN PROFESIONAL: Soporte para preguntas psicotécnicas en test_questions
--
-- PROBLEMA: test_questions solo tiene FK a tabla 'questions' (legislativas).
-- Las preguntas psicotécnicas están en 'psychometric_questions' y no tienen
-- referencia.
--
-- SOLUCIÓN PROFESIONAL: Añadir columna psychometric_question_id que referencie
-- a la tabla correcta. Así cada tipo de pregunta mantiene su integridad referencial.
-- =====================================================

-- 1. Añadir columna para preguntas psicotécnicas (puede ser null)
ALTER TABLE test_questions
ADD COLUMN IF NOT EXISTS psychometric_question_id UUID REFERENCES psychometric_questions(id);

-- 2. Añadir constraint CHECK para asegurar que exactamente una de las dos columnas tiene valor
-- (o question_id O psychometric_question_id, nunca ambas, nunca ninguna)
-- NOTA: Comentado porque puede haber datos legacy. Descomentar si se quiere enforcar.
-- ALTER TABLE test_questions
-- ADD CONSTRAINT check_question_reference
-- CHECK (
--   (question_id IS NOT NULL AND psychometric_question_id IS NULL) OR
--   (question_id IS NULL AND psychometric_question_id IS NOT NULL)
-- );

-- 3. Crear índice para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_test_questions_psychometric_id
ON test_questions(psychometric_question_id)
WHERE psychometric_question_id IS NOT NULL;

-- 4. Actualizar el trigger para manejar ambos tipos de preguntas
CREATE OR REPLACE FUNCTION trigger_update_law_question_difficulty()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  is_first_attempt BOOLEAN := FALSE;
  sample_size INTEGER;
BEGIN
  -- Si es pregunta psicotécnica (tiene psychometric_question_id), skip el tracking de dificultad legislativa
  -- Las psicotécnicas tienen su propio sistema de dificultad
  IF NEW.psychometric_question_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Si question_id es null (caso legacy o error), skip
  IF NEW.question_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Solo para preguntas legislativas: verificar si es primera respuesta del usuario
  INSERT INTO law_question_first_attempts (
    user_id,
    question_id,
    is_correct,
    time_taken_seconds,
    confidence_level,
    interaction_data
  )
  SELECT
    t.user_id,
    NEW.question_id,
    NEW.is_correct,
    NEW.time_spent_seconds,
    NEW.confidence_level,
    NEW.user_behavior_data
  FROM tests t
  WHERE t.id = NEW.test_id
  ON CONFLICT (user_id, question_id) DO NOTHING
  RETURNING TRUE INTO is_first_attempt;

  -- Si fue primera respuesta, actualizar dificultad global
  IF is_first_attempt THEN
    DECLARE
      new_global_difficulty NUMERIC;
    BEGIN
      new_global_difficulty := calculate_global_law_question_difficulty(NEW.question_id);

      -- Obtener tamaño de muestra
      SELECT COUNT(*) INTO sample_size
      FROM law_question_first_attempts
      WHERE question_id = NEW.question_id;

      -- Actualizar pregunta solo si tenemos suficientes datos
      IF new_global_difficulty IS NOT NULL THEN
        UPDATE questions
        SET
          global_difficulty = new_global_difficulty,
          difficulty_sample_size = sample_size,
          difficulty_confidence = LEAST(1.0, sample_size / 20.0),
          last_difficulty_update = NOW()
        WHERE id = NEW.question_id;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Verificación
DO $$
BEGIN
  -- Verificar que la columna existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_questions'
    AND column_name = 'psychometric_question_id'
  ) THEN
    RAISE NOTICE '✅ Columna psychometric_question_id añadida correctamente';
  ELSE
    RAISE EXCEPTION '❌ Error: La columna no se creó';
  END IF;

  RAISE NOTICE '✅ Migración completada:';
  RAISE NOTICE '   - Añadida columna psychometric_question_id con FK a psychometric_questions';
  RAISE NOTICE '   - Creado índice para búsquedas eficientes';
  RAISE NOTICE '   - Trigger actualizado para manejar ambos tipos de preguntas';
END $$;
