-- ============================================================
-- TRIGGERS PARA RESETEAR VERIFICACIÓN CUANDO SE MODIFICA CONTENIDO
-- ============================================================
--
-- Problema: Cuando se modifica una pregunta o un artículo después de
-- la verificación con IA, el estado de verificación queda obsoleto.
--
-- Solución: Triggers que resetean automáticamente el estado de
-- verificación cuando cambia el contenido relevante.
-- ============================================================

-- ============================================================
-- 1. TRIGGER PARA PREGUNTAS
-- ============================================================
-- Resetea verification_status y topic_review_status cuando cambian
-- campos relevantes de la pregunta.

CREATE OR REPLACE FUNCTION reset_question_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo resetear si cambiaron campos relevantes para la verificación
  IF (
    OLD.question_text IS DISTINCT FROM NEW.question_text OR
    OLD.option_a IS DISTINCT FROM NEW.option_a OR
    OLD.option_b IS DISTINCT FROM NEW.option_b OR
    OLD.option_c IS DISTINCT FROM NEW.option_c OR
    OLD.option_d IS DISTINCT FROM NEW.option_d OR
    OLD.correct_option IS DISTINCT FROM NEW.correct_option OR
    OLD.explanation IS DISTINCT FROM NEW.explanation OR
    OLD.primary_article_id IS DISTINCT FROM NEW.primary_article_id
  ) THEN
    -- No resetear si el UPDATE viene del propio sistema de verificación
    -- (detectado porque verification_status o topic_review_status están cambiando)
    IF (
      OLD.verification_status IS NOT DISTINCT FROM NEW.verification_status AND
      OLD.topic_review_status IS NOT DISTINCT FROM NEW.topic_review_status
    ) THEN
      -- Resetear estados de verificación
      NEW.verification_status := NULL;
      NEW.topic_review_status := NULL;
      NEW.verified_at := NULL;

      RAISE NOTICE 'Verificación reseteada para pregunta % (contenido modificado)', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS trigger_reset_question_verification ON questions;

-- Crear trigger
CREATE TRIGGER trigger_reset_question_verification
  BEFORE UPDATE ON questions
  FOR EACH ROW
  EXECUTE FUNCTION reset_question_verification();

-- ============================================================
-- 2. TRIGGER PARA ARTÍCULOS
-- ============================================================
-- Cuando se modifica el contenido de un artículo, resetea la
-- verificación de TODAS las preguntas vinculadas a ese artículo.

CREATE OR REPLACE FUNCTION reset_questions_on_article_update()
RETURNS TRIGGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- Solo actuar si cambió el contenido, título o número del artículo
  IF (
    OLD.content IS DISTINCT FROM NEW.content OR
    OLD.title IS DISTINCT FROM NEW.title OR
    OLD.article_number IS DISTINCT FROM NEW.article_number
  ) THEN
    -- Resetear verificación de todas las preguntas vinculadas
    UPDATE questions
    SET
      verification_status = NULL,
      topic_review_status = NULL,
      verified_at = NULL,
      updated_at = NOW()
    WHERE primary_article_id = NEW.id
      AND (verification_status IS NOT NULL OR topic_review_status IS NOT NULL);

    GET DIAGNOSTICS affected_count = ROW_COUNT;

    IF affected_count > 0 THEN
      RAISE NOTICE 'Verificación reseteada para % preguntas del artículo % (artículo modificado)',
        affected_count, NEW.article_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS trigger_reset_questions_on_article_update ON articles;

-- Crear trigger
CREATE TRIGGER trigger_reset_questions_on_article_update
  AFTER UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION reset_questions_on_article_update();

-- ============================================================
-- 3. ÍNDICE PARA OPTIMIZAR BÚSQUEDA DE PREGUNTAS POR ARTÍCULO
-- ============================================================
-- Asegura que el trigger de artículos sea eficiente

CREATE INDEX IF NOT EXISTS idx_questions_primary_article_id
  ON questions(primary_article_id)
  WHERE primary_article_id IS NOT NULL;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- Para verificar que los triggers están instalados:
-- SELECT trigger_name, event_manipulation, action_timing
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
-- AND trigger_name LIKE '%verification%';
