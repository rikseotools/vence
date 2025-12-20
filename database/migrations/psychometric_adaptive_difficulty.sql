-- =====================================================
-- SISTEMA DE DIFICULTAD ADAPTATIVA PARA PSICOTÉCNICOS
-- =====================================================
-- Implementa dificultad global (solo primera vez) vs personal (todas las veces)
-- Evita contaminación por aprendizaje repetido de preguntas

-- 1. CREAR TABLA PARA TRACKING DE PRIMERAS RESPUESTAS
-- =====================================================
CREATE TABLE IF NOT EXISTS psychometric_first_attempts (
  user_id UUID NOT NULL,
  question_id UUID NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_taken_seconds INTEGER,
  interaction_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES psychometric_questions(id) ON DELETE CASCADE
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_psychometric_first_attempts_question ON psychometric_first_attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_psychometric_first_attempts_user ON psychometric_first_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_psychometric_first_attempts_correct ON psychometric_first_attempts(is_correct);
CREATE INDEX IF NOT EXISTS idx_psychometric_first_attempts_created ON psychometric_first_attempts(created_at);

-- 2. ACTUALIZAR TABLA DE PREGUNTAS CON CAMPOS DE DIFICULTAD GLOBAL
-- =====================================================
ALTER TABLE psychometric_questions 
ADD COLUMN IF NOT EXISTS global_difficulty NUMERIC,
ADD COLUMN IF NOT EXISTS difficulty_sample_size INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_difficulty_update TIMESTAMP WITH TIME ZONE;

-- 3. FUNCIÓN PARA CALCULAR DIFICULTAD GLOBAL (SOLO PRIMERAS RESPUESTAS)
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_global_psychometric_difficulty(
  question_uuid UUID
) RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  first_attempts_accuracy NUMERIC;
  first_attempts_count INTEGER;
  avg_time_taken NUMERIC;
  difficulty_score NUMERIC;
BEGIN
  -- Solo contar primeras respuestas para evitar contaminación
  SELECT 
    AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END),
    COUNT(*),
    AVG(time_taken_seconds)
  INTO first_attempts_accuracy, first_attempts_count, avg_time_taken
  FROM psychometric_first_attempts 
  WHERE question_id = question_uuid;
  
  -- Necesita al menos 10 primeras respuestas para ser confiable
  IF first_attempts_count < 10 THEN
    RETURN NULL; -- Mantener dificultad original hasta tener datos suficientes
  END IF;
  
  -- Algoritmo de dificultad: 0-100 (más alto = más difícil)
  -- Factores: precisión (70%) + tiempo promedio (30%)
  difficulty_score := 0;
  
  -- Factor 1: Precisión (0-70 puntos)
  difficulty_score := difficulty_score + ((1.0 - first_attempts_accuracy) * 70);
  
  -- Factor 2: Tiempo promedio (0-30 puntos)
  -- Si toma más del doble del tiempo estimado, es más difícil
  IF avg_time_taken IS NOT NULL THEN
    DECLARE
      estimated_time NUMERIC;
    BEGIN
      SELECT estimated_time_seconds INTO estimated_time
      FROM psychometric_questions 
      WHERE id = question_uuid;
      
      IF estimated_time IS NOT NULL AND estimated_time > 0 THEN
        -- Si toma el doble de tiempo = +15 puntos, si es 3x = +30 puntos
        difficulty_score := difficulty_score + LEAST(30, ((avg_time_taken / estimated_time) - 1.0) * 15);
      END IF;
    END;
  END IF;
  
  -- Normalizar entre 0-100
  RETURN ROUND(GREATEST(0, LEAST(100, difficulty_score)), 1);
END;
$$;

-- 4. FUNCIÓN PARA ACTUALIZAR DIFICULTAD GLOBAL DE UNA PREGUNTA
-- =====================================================
CREATE OR REPLACE FUNCTION update_global_psychometric_difficulty(
  question_uuid UUID
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  new_difficulty NUMERIC;
  sample_size INTEGER;
BEGIN
  -- Calcular nueva dificultad
  new_difficulty := calculate_global_psychometric_difficulty(question_uuid);
  
  -- Obtener tamaño de muestra
  SELECT COUNT(*) INTO sample_size
  FROM psychometric_first_attempts
  WHERE question_id = question_uuid;
  
  -- Actualizar pregunta
  UPDATE psychometric_questions 
  SET 
    global_difficulty = new_difficulty,
    difficulty_sample_size = sample_size,
    last_difficulty_update = NOW()
  WHERE id = question_uuid;
  
  -- Log para debugging
  RAISE NOTICE 'Updated question % difficulty to % (sample size: %)', 
    question_uuid, new_difficulty, sample_size;
END;
$$;

-- 5. FUNCIÓN PARA CALCULAR DIFICULTAD PERSONAL (TODAS LAS RESPUESTAS)
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_personal_psychometric_difficulty(
  p_user_id UUID,
  p_question_id UUID
) RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  user_accuracy NUMERIC;
  user_attempts INTEGER;
  recent_accuracy NUMERIC;
  difficulty_score NUMERIC;
BEGIN
  -- Obtener estadísticas del usuario para esta pregunta
  SELECT 
    AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END),
    COUNT(*)
  INTO user_accuracy, user_attempts
  FROM psychometric_test_answers pta
  JOIN psychometric_test_sessions pts ON pta.session_id = pts.id
  WHERE pts.user_id = p_user_id 
  AND pta.question_id = p_question_id;
  
  -- Si no hay intentos, retornar NULL
  IF user_attempts = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Si solo tiene 1 intento, usar esa precisión
  IF user_attempts = 1 THEN
    RETURN CASE WHEN user_accuracy = 1.0 THEN 25.0 ELSE 75.0 END;
  END IF;
  
  -- Para múltiples intentos, calcular dificultad personal
  -- Más intentos fallidos = más difícil para este usuario
  difficulty_score := (1.0 - user_accuracy) * 80; -- Factor base
  
  -- Penalización por múltiples intentos fallidos
  IF user_attempts > 2 AND user_accuracy < 0.7 THEN
    difficulty_score := difficulty_score + (user_attempts * 5);
  END IF;
  
  -- Verificar tendencia reciente (últimos 3 intentos)
  SELECT AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) 
  INTO recent_accuracy
  FROM (
    SELECT is_correct
    FROM psychometric_test_answers pta
    JOIN psychometric_test_sessions pts ON pta.session_id = pts.id
    WHERE pts.user_id = p_user_id 
    AND pta.question_id = p_question_id
    ORDER BY pta.answered_at DESC
    LIMIT 3
  ) recent;
  
  -- Si está mejorando, reducir dificultad personal
  IF recent_accuracy > user_accuracy THEN
    difficulty_score := difficulty_score * 0.8;
  END IF;
  
  -- Normalizar entre 0-100
  RETURN ROUND(GREATEST(0, LEAST(100, difficulty_score)), 1);
END;
$$;

-- 6. TRIGGER PARA ACTUALIZAR DIFICULTAD AL INSERTAR PRIMERA RESPUESTA
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_update_psychometric_difficulty()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  is_first_attempt BOOLEAN := FALSE;
BEGIN
  -- Verificar si es primera respuesta del usuario para esta pregunta
  INSERT INTO psychometric_first_attempts (
    user_id, 
    question_id, 
    is_correct, 
    time_taken_seconds,
    interaction_data
  )
  SELECT 
    pts.user_id,
    NEW.question_id,
    NEW.is_correct,
    NEW.time_taken_seconds,
    NEW.interaction_data
  FROM psychometric_test_sessions pts
  WHERE pts.id = NEW.session_id
  ON CONFLICT (user_id, question_id) DO NOTHING
  RETURNING TRUE INTO is_first_attempt;
  
  -- Si fue primera respuesta, actualizar dificultad global
  IF is_first_attempt THEN
    PERFORM update_global_psychometric_difficulty(NEW.question_id);
  END IF;
  
  -- Siempre actualizar historial personal del usuario
  INSERT INTO psychometric_user_question_history (
    user_id,
    question_id,
    attempts,
    correct_attempts,
    total_time_seconds,
    personal_difficulty,
    first_attempt_at,
    last_attempt_at,
    trend
  )
  SELECT 
    pts.user_id,
    NEW.question_id,
    COUNT(*) as attempts,
    SUM(CASE WHEN pta.is_correct THEN 1 ELSE 0 END) as correct_attempts,
    SUM(pta.time_taken_seconds) as total_time,
    calculate_personal_psychometric_difficulty(pts.user_id, NEW.question_id),
    MIN(pta.answered_at) as first_attempt,
    MAX(pta.answered_at) as last_attempt,
    'stable' as trend -- Por ahora, se puede mejorar con algoritmo de tendencia
  FROM psychometric_test_sessions pts
  JOIN psychometric_test_answers pta ON pta.session_id = pts.id
  WHERE pts.user_id = (SELECT user_id FROM psychometric_test_sessions WHERE id = NEW.session_id)
  AND pta.question_id = NEW.question_id
  GROUP BY pts.user_id, NEW.question_id
  ON CONFLICT (user_id, question_id) 
  DO UPDATE SET
    attempts = EXCLUDED.attempts,
    correct_attempts = EXCLUDED.correct_attempts,
    total_time_seconds = EXCLUDED.total_time_seconds,
    personal_difficulty = EXCLUDED.personal_difficulty,
    last_attempt_at = EXCLUDED.last_attempt_at,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;

-- Crear trigger
DROP TRIGGER IF EXISTS tr_psychometric_difficulty_update ON psychometric_test_answers;
CREATE TRIGGER tr_psychometric_difficulty_update
  AFTER INSERT ON psychometric_test_answers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_psychometric_difficulty();

-- 7. FUNCIÓN PARA OBTENER DIFICULTAD EFECTIVA (GLOBAL O PERSONAL)
-- =====================================================
CREATE OR REPLACE FUNCTION get_effective_psychometric_difficulty(
  p_question_id UUID,
  p_user_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  global_diff NUMERIC;
  personal_diff NUMERIC;
  sample_size INTEGER;
  base_difficulty TEXT;
  result JSONB;
BEGIN
  -- Obtener dificultad base y global
  SELECT 
    pq.difficulty,
    pq.global_difficulty,
    pq.difficulty_sample_size
  INTO base_difficulty, global_diff, sample_size
  FROM psychometric_questions pq
  WHERE pq.id = p_question_id;
  
  -- Obtener dificultad personal si hay usuario
  IF p_user_id IS NOT NULL THEN
    personal_diff := calculate_personal_psychometric_difficulty(p_user_id, p_question_id);
  END IF;
  
  -- Construir respuesta
  result := jsonb_build_object(
    'question_id', p_question_id,
    'base_difficulty', base_difficulty,
    'global_difficulty', global_diff,
    'personal_difficulty', personal_diff,
    'sample_size', sample_size,
    'effective_difficulty', COALESCE(
      personal_diff, -- Prioridad 1: Personal si existe
      global_diff,   -- Prioridad 2: Global si hay suficientes datos
      CASE base_difficulty -- Prioridad 3: Base convertida a numérico
        WHEN 'easy' THEN 25.0
        WHEN 'medium' THEN 50.0
        WHEN 'hard' THEN 75.0
        ELSE 50.0
      END
    ),
    'recommendation', CASE
      WHEN personal_diff IS NOT NULL AND personal_diff < 30 THEN 'increase_difficulty'
      WHEN personal_diff IS NOT NULL AND personal_diff > 70 THEN 'decrease_difficulty'
      WHEN global_diff IS NOT NULL AND sample_size < 10 THEN 'need_more_data'
      ELSE 'optimal'
    END
  );
  
  RETURN result;
END;
$$;

-- 8. COMENTARIOS Y METADATOS
-- =====================================================
COMMENT ON TABLE psychometric_first_attempts IS 'Tracking de primeras respuestas para calcular dificultad global sin contaminación';
COMMENT ON FUNCTION calculate_global_psychometric_difficulty IS 'Calcula dificultad global basada SOLO en primeras respuestas para evitar aprendizaje repetido';
COMMENT ON FUNCTION calculate_personal_psychometric_difficulty IS 'Calcula dificultad personal considerando TODAS las respuestas del usuario';
COMMENT ON FUNCTION get_effective_psychometric_difficulty IS 'Obtiene dificultad efectiva priorizando: personal > global > base';

-- 9. MIGRACIÓN DE DATOS EXISTENTES (SI LOS HAY)
-- =====================================================
-- Nota: Este script preparará el sistema, pero como no hay datos aún,
-- no necesitamos migración. El sistema funcionará automáticamente
-- cuando empiecen a llegar respuestas.

SELECT 'Sistema de dificultad adaptativa psicotécnica instalado correctamente' as status;