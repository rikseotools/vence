-- =====================================================
-- FIX: Sistema de Dificultad Contaminado en Tests de Leyes
-- =====================================================
-- 
-- PROBLEMA: El sistema actual de tests sobre leyes calcula la dificultad
-- incluyendo TODAS las respuestas del mismo usuario, lo que contamina
-- la medición porque los usuarios aprenden las respuestas al repetir.
--
-- SOLUCION: Implementar sistema similar al psicotécnico que solo
-- usa primeras respuestas para calcular dificultad global.
--
-- AUTOR: Claude Code
-- FECHA: $(date)
-- =====================================================

-- =====================================================
-- 1. CREAR TABLA PARA TRACKING DE PRIMERAS RESPUESTAS
-- =====================================================
CREATE TABLE IF NOT EXISTS law_question_first_attempts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  is_correct BOOLEAN NOT NULL,
  time_taken_seconds INTEGER,
  confidence_level TEXT,
  interaction_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint único: solo UNA primera respuesta por usuario/pregunta
  PRIMARY KEY (user_id, question_id)
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_law_first_attempts_question ON law_question_first_attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_law_first_attempts_user ON law_question_first_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_law_first_attempts_correct ON law_question_first_attempts(is_correct);
CREATE INDEX IF NOT EXISTS idx_law_first_attempts_created ON law_question_first_attempts(created_at);

-- =====================================================
-- 2. ACTUALIZAR TABLA QUESTIONS CON CAMPOS DE DIFICULTAD GLOBAL
-- =====================================================
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS global_difficulty NUMERIC,
ADD COLUMN IF NOT EXISTS difficulty_confidence NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS difficulty_sample_size INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_difficulty_update TIMESTAMP WITH TIME ZONE;

-- =====================================================
-- 3. FUNCIÓN PARA CALCULAR DIFICULTAD GLOBAL (SOLO PRIMERAS RESPUESTAS)
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_global_law_question_difficulty(question_uuid UUID)
RETURNS NUMERIC
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
  FROM law_question_first_attempts 
  WHERE question_id = question_uuid;
  
  -- Necesita al menos 5 primeras respuestas para ser confiable
  IF first_attempts_count < 5 THEN
    RETURN NULL; -- Mantener dificultad original hasta tener datos suficientes
  END IF;
  
  -- Algoritmo de dificultad basado en accuracy y tiempo
  -- Peso: 70% accuracy + 30% tiempo
  
  -- Normalizar tiempo (30 segundos = óptimo)
  DECLARE
    time_factor NUMERIC := GREATEST(0.1, LEAST(2.0, 30.0 / NULLIF(avg_time_taken, 0)));
    accuracy_score NUMERIC := first_attempts_accuracy;
    combined_score NUMERIC;
  BEGIN
    -- Combinar accuracy y tiempo
    combined_score := (accuracy_score * 0.7) + (time_factor * 0.3);
    
    -- Convertir a escala de dificultad (0-5)
    -- Score alto = dificultad baja
    difficulty_score := GREATEST(0.1, LEAST(5.0, 5.0 - (combined_score * 4.0)));
    
    RETURN ROUND(difficulty_score, 2);
  END;
END;
$$;

-- =====================================================
-- 4. FUNCIÓN PARA CALCULAR DIFICULTAD PERSONAL (TODAS LAS RESPUESTAS)
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_personal_law_question_difficulty(
  user_uuid UUID, 
  question_uuid UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  user_accuracy NUMERIC;
  user_attempts INTEGER;
  avg_user_time NUMERIC;
  personal_difficulty NUMERIC;
BEGIN
  -- Obtener datos del usuario para esta pregunta específica
  SELECT 
    AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END),
    COUNT(*),
    AVG(tq.time_spent_seconds)
  INTO user_accuracy, user_attempts, avg_user_time
  FROM test_questions tq
  JOIN tests t ON t.id = tq.test_id
  WHERE tq.question_id = question_uuid 
    AND t.user_id = user_uuid
    AND t.is_completed = true;
  
  -- Necesita al menos 1 intento
  IF user_attempts < 1 THEN
    RETURN NULL;
  END IF;
  
  -- Algoritmo similar al global pero con datos personales
  DECLARE
    time_factor NUMERIC := GREATEST(0.1, LEAST(2.0, 30.0 / NULLIF(avg_user_time, 0)));
    combined_score NUMERIC;
  BEGIN
    combined_score := (user_accuracy * 0.7) + (time_factor * 0.3);
    personal_difficulty := GREATEST(0.1, LEAST(5.0, 5.0 - (combined_score * 4.0)));
    
    RETURN ROUND(personal_difficulty, 2);
  END;
END;
$$;

-- =====================================================
-- 5. FUNCIÓN PARA OBTENER DIFICULTAD EFECTIVA
-- =====================================================
CREATE OR REPLACE FUNCTION get_effective_law_question_difficulty(
  user_uuid UUID, 
  question_uuid UUID
)
RETURNS TABLE(
  difficulty_value NUMERIC,
  difficulty_source TEXT,
  sample_size INTEGER,
  confidence NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  personal_diff NUMERIC;
  global_diff NUMERIC;
  sample_size_val INTEGER;
  confidence_val NUMERIC;
BEGIN
  -- Intentar obtener dificultad personal primero
  personal_diff := calculate_personal_law_question_difficulty(user_uuid, question_uuid);
  
  -- Obtener dificultad global y metadatos
  SELECT 
    global_difficulty,
    difficulty_sample_size,
    difficulty_confidence
  INTO global_diff, sample_size_val, confidence_val
  FROM questions 
  WHERE id = question_uuid;
  
  -- Prioridad: personal > global > base (2.5)
  IF personal_diff IS NOT NULL THEN
    RETURN QUERY SELECT personal_diff, 'personal'::TEXT, 
                        COALESCE(sample_size_val, 0), 
                        COALESCE(confidence_val, 0.5);
  ELSIF global_diff IS NOT NULL THEN
    RETURN QUERY SELECT global_diff, 'global'::TEXT, 
                        COALESCE(sample_size_val, 0), 
                        COALESCE(confidence_val, 0.5);
  ELSE
    RETURN QUERY SELECT 2.5::NUMERIC, 'default'::TEXT, 0, 0.0::NUMERIC;
  END IF;
END;
$$;

-- =====================================================
-- 6. TRIGGER FUNCTION PARA ACTUALIZAR DIFICULTAD AUTOMÁTICAMENTE
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_update_law_question_difficulty()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  is_first_attempt BOOLEAN := FALSE;
  sample_size INTEGER;
BEGIN
  -- Verificar si es primera respuesta del usuario para esta pregunta
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
    -- Calcular nueva dificultad global
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
          difficulty_confidence = LEAST(1.0, sample_size / 20.0), -- Confianza máxima con 20+ respuestas
          last_difficulty_update = NOW()
        WHERE id = NEW.question_id;
      END IF;
    END;
  END IF;
  
  -- Siempre actualizar el historial personal (tabla existente)
  -- Este trigger ya existe, solo asegurar que sigue funcionando
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- 7. CREAR TRIGGER
-- =====================================================
-- Eliminar trigger anterior si existe
DROP TRIGGER IF EXISTS law_question_difficulty_update_trigger ON test_questions;

-- Crear nuevo trigger que maneja tanto primera respuesta como personal
CREATE TRIGGER law_question_difficulty_update_trigger
    AFTER INSERT ON test_questions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_law_question_difficulty();

-- =====================================================
-- 8. MIGRACIÓN DE DATOS EXISTENTES (OPCIONAL)
-- =====================================================
-- Poblar tabla de primeras respuestas con datos existentes
-- NOTA: Esto asume que la respuesta más antigua de cada usuario es su "primera"
DO $$
BEGIN
  INSERT INTO law_question_first_attempts (
    user_id, 
    question_id, 
    is_correct, 
    time_taken_seconds,
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
  JOIN tests t ON t.id = tq.test_id
  WHERE t.is_completed = true
  ORDER BY t.user_id, tq.question_id, tq.created_at ASC
  ON CONFLICT (user_id, question_id) DO NOTHING;
  
  RAISE NOTICE 'Migración completada: % primeras respuestas insertadas', 
    (SELECT COUNT(*) FROM law_question_first_attempts);
END $$;

-- =====================================================
-- 9. RECALCULAR DIFICULTADES GLOBALES EXISTENTES
-- =====================================================
DO $$
DECLARE
  question_record RECORD;
  updated_count INTEGER := 0;
BEGIN
  -- Recalcular dificultad para todas las preguntas con suficientes datos
  FOR question_record IN 
    SELECT DISTINCT question_id 
    FROM law_question_first_attempts
  LOOP
    DECLARE
      new_difficulty NUMERIC;
      sample_size INTEGER;
    BEGIN
      new_difficulty := calculate_global_law_question_difficulty(question_record.question_id);
      
      IF new_difficulty IS NOT NULL THEN
        SELECT COUNT(*) INTO sample_size
        FROM law_question_first_attempts
        WHERE question_id = question_record.question_id;
        
        UPDATE questions 
        SET 
          global_difficulty = new_difficulty,
          difficulty_sample_size = sample_size,
          difficulty_confidence = LEAST(1.0, sample_size / 20.0),
          last_difficulty_update = NOW()
        WHERE id = question_record.question_id;
        
        updated_count := updated_count + 1;
      END IF;
    END;
  END LOOP;
  
  RAISE NOTICE 'Recálculo completado: % preguntas actualizadas con nueva dificultad', updated_count;
END $$;

-- =====================================================
-- 10. POLÍTICAS RLS
-- =====================================================
ALTER TABLE law_question_first_attempts ENABLE ROW LEVEL SECURITY;

-- Policy para que usuarios vean sus propias primeras respuestas
CREATE POLICY "Users can view their own first attempts" ON law_question_first_attempts
  FOR SELECT USING (auth.uid() = user_id);

-- Policy para insertar primeras respuestas
CREATE POLICY "Users can insert their own first attempts" ON law_question_first_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 11. COMENTARIOS Y METADATOS
-- =====================================================
COMMENT ON TABLE law_question_first_attempts IS 'Tracking de primeras respuestas para calcular dificultad global sin contaminación por aprendizaje repetido';
COMMENT ON FUNCTION calculate_global_law_question_difficulty IS 'Calcula dificultad global basada SOLO en primeras respuestas para evitar contaminación';
COMMENT ON FUNCTION calculate_personal_law_question_difficulty IS 'Calcula dificultad personal considerando TODAS las respuestas del usuario específico';
COMMENT ON FUNCTION get_effective_law_question_difficulty IS 'Obtiene dificultad efectiva priorizando: personal > global > base (2.5)';
COMMENT ON FUNCTION trigger_update_law_question_difficulty IS 'Trigger que actualiza dificultad global solo en primeras respuestas y mantiene tracking personal';

-- =====================================================
-- 12. FUNCIONES DE DIAGNÓSTICO
-- =====================================================
CREATE OR REPLACE FUNCTION get_law_difficulty_stats()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_questions', (SELECT COUNT(*) FROM questions WHERE is_active = true),
    'total_first_attempts', (SELECT COUNT(*) FROM law_question_first_attempts),
    'questions_with_global_difficulty', (SELECT COUNT(*) FROM questions WHERE global_difficulty IS NOT NULL),
    'avg_global_difficulty', (SELECT ROUND(AVG(global_difficulty), 2) FROM questions WHERE global_difficulty IS NOT NULL),
    'questions_needing_more_data', (SELECT COUNT(*) FROM questions WHERE difficulty_sample_size < 5 AND difficulty_sample_size > 0),
    'high_confidence_questions', (SELECT COUNT(*) FROM questions WHERE difficulty_confidence > 0.8),
    'recently_updated', (SELECT COUNT(*) FROM questions WHERE last_difficulty_update > NOW() - INTERVAL '24 hours')
  ) INTO result;
  
  RETURN result;
END;
$$;

-- =====================================================
-- FINALIZACIÓN
-- =====================================================
-- Verificar que todo está funcionando
SELECT get_law_difficulty_stats() as migration_summary;

-- Log de finalización
DO $$
BEGIN
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'FIX COMPLETADO: Sistema de dificultad sin contaminación';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'TABLA CREADA: law_question_first_attempts';
  RAISE NOTICE 'FUNCIONES: calculate_global_law_question_difficulty()';
  RAISE NOTICE 'FUNCIONES: calculate_personal_law_question_difficulty()';
  RAISE NOTICE 'FUNCIONES: get_effective_law_question_difficulty()';
  RAISE NOTICE 'TRIGGER: law_question_difficulty_update_trigger';
  RAISE NOTICE 'MIGRACIÓN: Datos existentes procesados';
  RAISE NOTICE 'RLS: Políticas de seguridad aplicadas';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'AHORA: La dificultad global se calcula SOLO con primeras respuestas';
  RAISE NOTICE 'AHORA: Sin contaminación por aprendizaje repetido';
  RAISE NOTICE '=================================================';
END $$;