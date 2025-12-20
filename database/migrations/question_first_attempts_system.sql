-- =====================================================
-- SISTEMA DE DIFICULTAD BASADO EN PRIMEROS INTENTOS
-- =====================================================
-- Sistema seguro que NO modifica datos existentes
-- Solo añade nueva funcionalidad para calcular dificultad real

-- =====================================================
-- FASE 1: CREAR TABLA PARA PRIMEROS INTENTOS
-- =====================================================

-- Tabla para trackear SOLO el primer intento de cada usuario en cada pregunta
CREATE TABLE IF NOT EXISTS question_first_attempts (
  user_id UUID NOT NULL,
  question_id UUID NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_spent_seconds INTEGER,
  confidence_level TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_question_first_attempts_question ON question_first_attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_question_first_attempts_user ON question_first_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_question_first_attempts_correct ON question_first_attempts(is_correct);
CREATE INDEX IF NOT EXISTS idx_question_first_attempts_created ON question_first_attempts(created_at);

COMMENT ON TABLE question_first_attempts IS 'Trackea SOLO el primer intento de cada usuario en cada pregunta para calcular dificultad real sin contaminación por repeticiones';

-- =====================================================
-- FASE 2: FUNCIÓN PARA CALCULAR DIFICULTAD GLOBAL
-- =====================================================
-- Calcula dificultad basándose SOLO en primeros intentos

CREATE OR REPLACE FUNCTION calculate_question_global_difficulty(
  p_question_id UUID
) RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_first_attempts_accuracy NUMERIC;
  v_first_attempts_count INTEGER;
  v_avg_time_taken NUMERIC;
  v_avg_confidence NUMERIC;
  v_difficulty_score NUMERIC;
BEGIN
  -- Obtener estadísticas SOLO de primeros intentos
  SELECT
    AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) * 100,
    COUNT(*),
    AVG(time_spent_seconds),
    AVG(
      CASE confidence_level
        WHEN 'very_sure' THEN 4.0
        WHEN 'sure' THEN 3.0
        WHEN 'unsure' THEN 2.0
        WHEN 'guessing' THEN 1.0
        ELSE 2.5
      END
    )
  INTO v_first_attempts_accuracy, v_first_attempts_count, v_avg_time_taken, v_avg_confidence
  FROM question_first_attempts
  WHERE question_id = p_question_id;

  -- Necesita al menos 3 primeros intentos para ser confiable
  IF v_first_attempts_count < 3 THEN
    RETURN NULL;
  END IF;

  -- Algoritmo de dificultad: 0-100 (más alto = más difícil)
  v_difficulty_score := 0;

  -- Factor 1: Tasa de error (0-50 puntos)
  -- 0% acierto = 50 puntos, 100% acierto = 0 puntos
  v_difficulty_score := v_difficulty_score + ((100 - v_first_attempts_accuracy) * 0.5);

  -- Factor 2: Tiempo promedio (0-25 puntos)
  -- Más de 2 minutos = difícil
  IF v_avg_time_taken IS NOT NULL THEN
    v_difficulty_score := v_difficulty_score +
      CASE
        WHEN v_avg_time_taken > 120 THEN 25
        WHEN v_avg_time_taken > 90 THEN 15
        WHEN v_avg_time_taken > 60 THEN 8
        ELSE 0
      END;
  END IF;

  -- Factor 3: Confianza promedio (0-25 puntos)
  -- Baja confianza = más difícil
  IF v_avg_confidence IS NOT NULL THEN
    v_difficulty_score := v_difficulty_score +
      CASE
        WHEN v_avg_confidence < 2.0 THEN 25
        WHEN v_avg_confidence < 2.5 THEN 15
        WHEN v_avg_confidence < 3.0 THEN 8
        ELSE 0
      END;
  END IF;

  -- Normalizar entre 0-100
  RETURN ROUND(GREATEST(0, LEAST(100, v_difficulty_score)), 1);
END;
$$;

COMMENT ON FUNCTION calculate_question_global_difficulty IS 'Calcula dificultad global de una pregunta basándose SOLO en primeros intentos de usuarios (mínimo 3 para ser confiable)';

-- =====================================================
-- FASE 3: FUNCIÓN PARA ACTUALIZAR DIFICULTAD
-- =====================================================

CREATE OR REPLACE FUNCTION update_question_global_difficulty(
  p_question_id UUID
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_difficulty NUMERIC;
  v_sample_size INTEGER;
  v_difficulty_text TEXT;
  v_confidence NUMERIC;
BEGIN
  -- Calcular nueva dificultad
  v_new_difficulty := calculate_question_global_difficulty(p_question_id);

  -- Obtener tamaño de muestra
  SELECT COUNT(*) INTO v_sample_size
  FROM question_first_attempts
  WHERE question_id = p_question_id;

  -- Si no hay suficientes datos, no actualizar
  IF v_new_difficulty IS NULL THEN
    RETURN;
  END IF;

  -- Convertir dificultad numérica a texto
  v_difficulty_text :=
    CASE
      WHEN v_new_difficulty >= 75 THEN 'extreme'
      WHEN v_new_difficulty >= 50 THEN 'hard'
      WHEN v_new_difficulty >= 25 THEN 'medium'
      ELSE 'easy'
    END;

  -- Calcular confianza (0-1) basada en tamaño de muestra
  -- 10 intentos = 0.5 confianza, 50+ intentos = 1.0 confianza
  v_confidence := LEAST(1.0, v_sample_size / 50.0);

  -- Actualizar pregunta (NO toca 'difficulty', usa 'global_difficulty')
  UPDATE questions
  SET
    global_difficulty = v_new_difficulty,
    difficulty_sample_size = v_sample_size,
    difficulty_confidence = v_confidence,
    last_difficulty_update = NOW()
  WHERE id = p_question_id;

  -- Log para debugging
  RAISE NOTICE 'Updated question % global_difficulty to % (%, sample: %, confidence: %)',
    p_question_id, v_new_difficulty, v_difficulty_text, v_sample_size, v_confidence;
END;
$$;

COMMENT ON FUNCTION update_question_global_difficulty IS 'Actualiza global_difficulty de una pregunta (NO toca difficulty estática)';

-- =====================================================
-- FASE 4: TRIGGER PARA TRACKEAR PRIMEROS INTENTOS
-- =====================================================

CREATE OR REPLACE FUNCTION track_question_first_attempt()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_is_first_attempt BOOLEAN;
BEGIN
  -- Obtener user_id del test
  SELECT user_id INTO v_user_id
  FROM tests
  WHERE id = NEW.test_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verificar si es el primer intento de este usuario en esta pregunta
  SELECT NOT EXISTS (
    SELECT 1
    FROM question_first_attempts
    WHERE user_id = v_user_id
    AND question_id = NEW.question_id
  ) INTO v_is_first_attempt;

  -- Si es el primer intento, guardarlo
  IF v_is_first_attempt THEN
    INSERT INTO question_first_attempts (
      user_id,
      question_id,
      is_correct,
      time_spent_seconds,
      confidence_level,
      created_at
    ) VALUES (
      v_user_id,
      NEW.question_id,
      NEW.is_correct,
      NEW.time_spent_seconds,
      NEW.confidence_level,
      NOW()
    )
    ON CONFLICT (user_id, question_id) DO NOTHING;

    -- Actualizar dificultad global de la pregunta
    PERFORM update_question_global_difficulty(NEW.question_id);
  END IF;

  RETURN NEW;
END;
$$;

-- Crear trigger en test_questions
DROP TRIGGER IF EXISTS track_first_attempt_trigger ON test_questions;
CREATE TRIGGER track_first_attempt_trigger
  AFTER INSERT ON test_questions
  FOR EACH ROW
  EXECUTE FUNCTION track_question_first_attempt();

COMMENT ON FUNCTION track_question_first_attempt IS 'Trigger que trackea primer intento de cada usuario en cada pregunta y actualiza dificultad global';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Verificar que todo se creó correctamente
DO $$
BEGIN
  RAISE NOTICE '✅ Sistema de primeros intentos instalado correctamente';
  RAISE NOTICE '📊 Tabla question_first_attempts: %',
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'question_first_attempts');
  RAISE NOTICE '🔧 Función calculate_question_global_difficulty: %',
    (SELECT COUNT(*) FROM pg_proc WHERE proname = 'calculate_question_global_difficulty');
  RAISE NOTICE '🔧 Función update_question_global_difficulty: %',
    (SELECT COUNT(*) FROM pg_proc WHERE proname = 'update_question_global_difficulty');
  RAISE NOTICE '⚡ Trigger track_first_attempt_trigger: %',
    (SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'track_first_attempt_trigger');
END $$;
