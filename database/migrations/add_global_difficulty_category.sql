-- =====================================================
-- AÑADIR COLUMNA global_difficulty_category
-- =====================================================
-- Añade versión textual de global_difficulty para poder
-- filtrar directamente en queries de Supabase

-- 1️⃣ Añadir columna
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS global_difficulty_category TEXT;

CREATE INDEX IF NOT EXISTS idx_questions_global_difficulty_category
ON questions(global_difficulty_category)
WHERE global_difficulty_category IS NOT NULL;

COMMENT ON COLUMN questions.global_difficulty_category IS 'Dificultad calculada en formato texto (easy/medium/hard/extreme) basada en primeros intentos reales. Se sincroniza automáticamente desde global_difficulty.';

-- 2️⃣ Actualizar función para calcular versión textual también
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
  -- Calcular nueva dificultad numérica
  v_new_difficulty := calculate_question_global_difficulty(p_question_id);

  -- Obtener tamaño de muestra
  SELECT COUNT(*) INTO v_sample_size
  FROM question_first_attempts
  WHERE question_id = p_question_id;

  -- Si no hay suficientes datos, limpiar y salir
  IF v_new_difficulty IS NULL THEN
    UPDATE questions
    SET
      global_difficulty = NULL,
      global_difficulty_category = NULL,
      difficulty_sample_size = NULL,
      difficulty_confidence = NULL,
      last_difficulty_update = NULL
    WHERE id = p_question_id;
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
  v_confidence := LEAST(1.0, v_sample_size / 50.0);

  -- Actualizar pregunta con ambas versiones
  UPDATE questions
  SET
    global_difficulty = v_new_difficulty,
    global_difficulty_category = v_difficulty_text,
    difficulty_sample_size = v_sample_size,
    difficulty_confidence = v_confidence,
    last_difficulty_update = NOW()
  WHERE id = p_question_id;
END;
$$;

COMMENT ON FUNCTION update_question_global_difficulty IS 'Actualiza global_difficulty (numérica) y global_difficulty_category (textual)';

-- 3️⃣ Backfill: Actualizar todas las preguntas existentes con global_difficulty
DO $$
DECLARE
  v_question_record RECORD;
  v_updated_count INTEGER := 0;
  v_total_to_update INTEGER;
BEGIN
  -- Contar preguntas a actualizar
  SELECT COUNT(*) INTO v_total_to_update
  FROM questions
  WHERE global_difficulty IS NOT NULL
  AND global_difficulty_category IS NULL;

  RAISE NOTICE 'Actualizando % preguntas con global_difficulty_category', v_total_to_update;

  -- Actualizar cada pregunta
  FOR v_question_record IN
    SELECT id, global_difficulty
    FROM questions
    WHERE global_difficulty IS NOT NULL
    AND global_difficulty_category IS NULL
  LOOP
    UPDATE questions
    SET global_difficulty_category =
      CASE
        WHEN v_question_record.global_difficulty >= 75 THEN 'extreme'
        WHEN v_question_record.global_difficulty >= 50 THEN 'hard'
        WHEN v_question_record.global_difficulty >= 25 THEN 'medium'
        ELSE 'easy'
      END
    WHERE id = v_question_record.id;

    v_updated_count := v_updated_count + 1;

    IF v_updated_count % 100 = 0 THEN
      RAISE NOTICE 'Procesadas: %', v_updated_count;
    END IF;
  END LOOP;

  RAISE NOTICE 'Total actualizadas: %', v_updated_count;
END $$;

-- 4️⃣ Verificar resultados
SELECT
  'Resultados backfill' as step,
  (SELECT COUNT(*) FROM questions WHERE global_difficulty IS NOT NULL) as con_global_difficulty_numerica,
  (SELECT COUNT(*) FROM questions WHERE global_difficulty_category IS NOT NULL) as con_global_difficulty_category,
  (SELECT COUNT(*) FROM questions WHERE global_difficulty IS NOT NULL AND global_difficulty_category IS NULL) as desincronizadas;

-- Ver distribución
SELECT
  global_difficulty_category,
  COUNT(*) as total,
  ROUND(AVG(global_difficulty), 1) as promedio_numerico,
  ROUND(AVG(difficulty_sample_size), 0) as promedio_muestras
FROM questions
WHERE global_difficulty_category IS NOT NULL
GROUP BY global_difficulty_category
ORDER BY
  CASE global_difficulty_category
    WHEN 'easy' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'hard' THEN 3
    WHEN 'extreme' THEN 4
  END;
