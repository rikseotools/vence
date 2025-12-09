-- =====================================================
-- POBLAR PRIMEROS INTENTOS HISTÓRICOS
-- =====================================================
-- Script SEGURO para identificar primeros intentos de datos históricos
-- NO modifica datos existentes, solo pobla la nueva tabla

-- =====================================================
-- PASO 1: VERIFICAR ESTADO ACTUAL
-- =====================================================

SELECT
  'Estado antes de migración' as step,
  (SELECT COUNT(*) FROM question_first_attempts) as first_attempts_registrados,
  (SELECT COUNT(*) FROM test_questions) as total_respuestas,
  (SELECT COUNT(DISTINCT question_id) FROM questions WHERE global_difficulty IS NOT NULL) as preguntas_con_dificultad;

-- =====================================================
-- PASO 2: IDENTIFICAR PRIMEROS INTENTOS HISTÓRICOS
-- =====================================================
-- Esta query identifica el primer intento de cada usuario en cada pregunta

WITH first_attempts_historical AS (
  SELECT DISTINCT ON (t.user_id, tq.question_id)
    t.user_id,
    tq.question_id,
    tq.is_correct,
    tq.time_spent_seconds,
    tq.confidence_level,
    tq.created_at
  FROM test_questions tq
  JOIN tests t ON tq.test_id = t.id
  WHERE t.user_id IS NOT NULL
  AND tq.question_id IS NOT NULL
  ORDER BY t.user_id, tq.question_id, tq.created_at ASC
)
SELECT COUNT(*) as primeros_intentos_encontrados
FROM first_attempts_historical;

-- =====================================================
-- PASO 3: POBLAR TABLA question_first_attempts
-- =====================================================
-- Inserta SOLO los primeros intentos históricos

INSERT INTO question_first_attempts (
  user_id,
  question_id,
  is_correct,
  time_spent_seconds,
  confidence_level,
  created_at
)
SELECT DISTINCT ON (t.user_id, tq.question_id)
  t.user_id,
  tq.question_id,
  tq.is_correct,
  tq.time_spent_seconds,
  tq.confidence_level,
  tq.created_at
FROM test_questions tq
JOIN tests t ON tq.test_id = t.id
WHERE t.user_id IS NOT NULL
AND tq.question_id IS NOT NULL
ORDER BY t.user_id, tq.question_id, tq.created_at ASC
ON CONFLICT (user_id, question_id) DO NOTHING;

-- Mensaje de progreso
DO $$
DECLARE
  v_inserted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_inserted_count FROM question_first_attempts;
  RAISE NOTICE '✅ Insertados % primeros intentos históricos', v_inserted_count;
END $$;

-- =====================================================
-- PASO 4: CALCULAR DIFICULTADES PARA PREGUNTAS CON SUFICIENTES DATOS
-- =====================================================
-- Solo actualiza preguntas que tengan al menos 10 primeros intentos

DO $$
DECLARE
  v_question_record RECORD;
  v_updated_count INTEGER := 0;
  v_total_to_update INTEGER;
BEGIN
  -- Contar preguntas a actualizar
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

  RAISE NOTICE '✅ Actualizadas % preguntas con dificultad global', v_updated_count;
END $$;

-- =====================================================
-- PASO 5: VERIFICAR RESULTADOS
-- =====================================================

SELECT
  'Resultados de migración' as step,
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

-- Comparar dificultad estática vs global (sample)
SELECT
  q.difficulty as dificultad_estatica,
  CASE
    WHEN q.global_difficulty < 25 THEN 'easy'
    WHEN q.global_difficulty < 50 THEN 'medium'
    WHEN q.global_difficulty < 75 THEN 'hard'
    ELSE 'extreme'
  END as dificultad_calculada,
  COUNT(*) as total,
  ROUND(AVG(q.difficulty_sample_size), 0) as avg_samples
FROM questions q
WHERE q.global_difficulty IS NOT NULL
GROUP BY q.difficulty,
  CASE
    WHEN q.global_difficulty < 25 THEN 'easy'
    WHEN q.global_difficulty < 50 THEN 'medium'
    WHEN q.global_difficulty < 75 THEN 'hard'
    ELSE 'extreme'
  END
ORDER BY q.difficulty, dificultad_calculada;

-- =====================================================
-- INFORMACIÓN FINAL
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=================================================';
  RAISE NOTICE '✅ MIGRACIÓN COMPLETADA EXITOSAMENTE';
  RAISE NOTICE '=================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Sistema de primeros intentos configurado y poblado con datos históricos.';
  RAISE NOTICE 'A partir de ahora, cada nueva respuesta actualizará automáticamente la dificultad.';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANTE:';
  RAISE NOTICE '   - La dificultad estática (difficulty) NO fue modificada';
  RAISE NOTICE '   - La dificultad calculada está en global_difficulty';
  RAISE NOTICE '   - El frontend debe actualizarse para usar global_difficulty';
  RAISE NOTICE '';
END $$;
