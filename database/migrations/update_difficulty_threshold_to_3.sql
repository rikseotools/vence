-- =====================================================
-- ACTUALIZAR UMBRAL DE DIFICULTAD A 3 INTENTOS
-- =====================================================
-- Cambia el umbral mínimo de 1 a 3 intentos para evitar
-- que un solo usuario "condene" una pregunta a extreme

-- 1️⃣ Actualizar función para requerir mínimo 3 intentos
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

-- 2️⃣ Recalcular dificultades con el nuevo umbral
DO $$
DECLARE
  v_question_record RECORD;
  v_updated_count INTEGER := 0;
  v_removed_count INTEGER := 0;
  v_total_to_update INTEGER;
BEGIN
  -- Primero, limpiar preguntas que ya no cumplen el umbral (tenían 1-2 intentos)
  UPDATE questions
  SET
    global_difficulty = NULL,
    difficulty_sample_size = NULL,
    difficulty_confidence = NULL,
    last_difficulty_update = NULL
  WHERE id IN (
    SELECT question_id
    FROM question_first_attempts
    GROUP BY question_id
    HAVING COUNT(*) < 3
  )
  AND global_difficulty IS NOT NULL;

  GET DIAGNOSTICS v_removed_count = ROW_COUNT;
  RAISE NOTICE '🗑️  Limpiadas % preguntas que tenían 1-2 intentos', v_removed_count;

  -- Contar preguntas a actualizar (ahora con umbral de 3)
  SELECT COUNT(*) INTO v_total_to_update
  FROM (
    SELECT question_id
    FROM question_first_attempts
    GROUP BY question_id
    HAVING COUNT(*) >= 3
  ) q;

  RAISE NOTICE '📊 Actualizando dificultad de % preguntas con 3+ primeros intentos...', v_total_to_update;

  -- Actualizar cada pregunta
  FOR v_question_record IN
    SELECT question_id, COUNT(*) as sample_size
    FROM question_first_attempts
    GROUP BY question_id
    HAVING COUNT(*) >= 3
    ORDER BY COUNT(*) DESC
  LOOP
    PERFORM update_question_global_difficulty(v_question_record.question_id);
    v_updated_count := v_updated_count + 1;

    -- Progreso cada 100 preguntas
    IF v_updated_count % 100 = 0 THEN
      RAISE NOTICE '  ... procesadas % / % preguntas', v_updated_count, v_total_to_update;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Actualizadas % preguntas con dificultad global (umbral: 3 intentos)', v_updated_count;
END $$;

-- 3️⃣ Verificar resultados
SELECT
  'Resultados con umbral de 3 intentos' as step,
  (SELECT COUNT(*) FROM question_first_attempts) as first_attempts_registrados,
  (SELECT COUNT(DISTINCT question_id) FROM question_first_attempts) as preguntas_con_intentos,
  (SELECT COUNT(*) FROM questions WHERE global_difficulty IS NOT NULL) as preguntas_con_dificultad_calculada,
  (SELECT ROUND(AVG(difficulty_sample_size), 0) FROM questions WHERE global_difficulty IS NOT NULL) as promedio_muestras;

-- Ver distribución de dificultades calculadas
SELECT
  CASE
    WHEN global_difficulty < 25 THEN 'Easy (0-25)'
    WHEN global_difficulty < 50 THEN 'Medium (25-50)'
    WHEN global_difficulty < 75 THEN 'Hard (50-75)'
    ELSE 'Extreme (75+)'
  END as rango_dificultad,
  COUNT(*) as total_preguntas,
  ROUND(AVG(difficulty_sample_size), 0) as promedio_muestras,
  ROUND(AVG(difficulty_confidence), 2) as promedio_confianza
FROM questions
WHERE global_difficulty IS NOT NULL
GROUP BY
  CASE
    WHEN global_difficulty < 25 THEN 'Easy (0-25)'
    WHEN global_difficulty < 50 THEN 'Medium (25-50)'
    WHEN global_difficulty < 75 THEN 'Hard (50-75)'
    ELSE 'Extreme (75+)'
  END
ORDER BY MIN(global_difficulty);
