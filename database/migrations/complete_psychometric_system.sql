-- =====================================================
-- COMPLETAR SISTEMA DE DIFICULTAD ADAPTATIVA PSICOTÉCNICA
-- =====================================================
-- Agregar campos faltantes y crear tabla psychometric_user_question_history

-- 1. CREAR TABLA psychometric_user_question_history SI NO EXISTE
-- =====================================================
CREATE TABLE IF NOT EXISTS psychometric_user_question_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question_id UUID NOT NULL,
  attempts INTEGER DEFAULT 1,
  correct_attempts INTEGER DEFAULT 0,
  total_time_seconds INTEGER DEFAULT 0,
  personal_difficulty NUMERIC,
  first_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  trend TEXT DEFAULT 'stable',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, question_id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES psychometric_questions(id) ON DELETE CASCADE
);

-- Índices para psychometric_user_question_history
CREATE INDEX IF NOT EXISTS idx_psychometric_user_history_user ON psychometric_user_question_history(user_id);
CREATE INDEX IF NOT EXISTS idx_psychometric_user_history_question ON psychometric_user_question_history(question_id);
CREATE INDEX IF NOT EXISTS idx_psychometric_user_history_difficulty ON psychometric_user_question_history(personal_difficulty);

-- 2. VERIFICAR Y AGREGAR CAMPOS FALTANTES A psychometric_test_sessions
-- =====================================================
-- Verificar si start_time existe, si no, agregarlo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'psychometric_test_sessions' 
    AND column_name = 'start_time'
  ) THEN
    ALTER TABLE psychometric_test_sessions 
    ADD COLUMN start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Verificar si end_time existe, si no, agregarlo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'psychometric_test_sessions' 
    AND column_name = 'end_time'
  ) THEN
    ALTER TABLE psychometric_test_sessions 
    ADD COLUMN end_time TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Verificar si is_completed existe, si no, agregarlo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'psychometric_test_sessions' 
    AND column_name = 'is_completed'
  ) THEN
    ALTER TABLE psychometric_test_sessions 
    ADD COLUMN is_completed BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Verificar si score existe, si no, agregarlo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'psychometric_test_sessions' 
    AND column_name = 'score'
  ) THEN
    ALTER TABLE psychometric_test_sessions 
    ADD COLUMN score INTEGER DEFAULT 0;
  END IF;
END $$;

-- 3. VERIFICAR Y AGREGAR CAMPOS FALTANTES A psychometric_test_answers
-- =====================================================
-- Verificar si answered_at existe, si no, agregarlo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'psychometric_test_answers' 
    AND column_name = 'answered_at'
  ) THEN
    ALTER TABLE psychometric_test_answers 
    ADD COLUMN answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- 4. VERIFICAR Y AGREGAR CAMPO estimated_time_seconds SI NO EXISTE
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'psychometric_questions' 
    AND column_name = 'estimated_time_seconds'
  ) THEN
    ALTER TABLE psychometric_questions 
    ADD COLUMN estimated_time_seconds INTEGER DEFAULT 120;
  END IF;
END $$;

-- 5. FUNCIÓN HELPER PARA DEBUGGING
-- =====================================================
CREATE OR REPLACE FUNCTION debug_psychometric_system()
RETURNS TABLE(
  table_name TEXT,
  column_name TEXT,
  data_type TEXT,
  is_nullable TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.table_name::TEXT,
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT
  FROM information_schema.tables t
  JOIN information_schema.columns c ON t.table_name = c.table_name
  WHERE t.table_schema = 'public' 
  AND t.table_name LIKE 'psychometric_%'
  ORDER BY t.table_name, c.ordinal_position;
END;
$$;

-- 6. FUNCIÓN PARA OBTENER ESTADÍSTICAS DEL SISTEMA
-- =====================================================
CREATE OR REPLACE FUNCTION get_psychometric_system_stats()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_questions', (SELECT COUNT(*) FROM psychometric_questions WHERE is_active = true),
    'total_first_attempts', (SELECT COUNT(*) FROM psychometric_first_attempts),
    'total_user_histories', (SELECT COUNT(*) FROM psychometric_user_question_history),
    'questions_with_adaptive_difficulty', (SELECT COUNT(*) FROM psychometric_questions WHERE global_difficulty IS NOT NULL),
    'avg_global_difficulty', (SELECT ROUND(AVG(global_difficulty), 2) FROM psychometric_questions WHERE global_difficulty IS NOT NULL),
    'questions_needing_more_data', (SELECT COUNT(*) FROM psychometric_questions WHERE difficulty_sample_size < 10 AND difficulty_sample_size > 0)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- 7. RLS POLICIES PARA SEGURIDAD
-- =====================================================
-- Enable RLS en las nuevas tablas
ALTER TABLE psychometric_first_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE psychometric_user_question_history ENABLE ROW LEVEL SECURITY;

-- Policy para psychometric_first_attempts
CREATE POLICY "Users can view their own first attempts" ON psychometric_first_attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own first attempts" ON psychometric_first_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy para psychometric_user_question_history  
CREATE POLICY "Users can view their own question history" ON psychometric_user_question_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage question history" ON psychometric_user_question_history
  FOR ALL USING (true);

-- 8. COMENTARIOS
-- =====================================================
COMMENT ON TABLE psychometric_user_question_history IS 'Historial personal de cada usuario con cada pregunta psicotécnica';
COMMENT ON FUNCTION debug_psychometric_system IS 'Función de debugging para ver estructura de tablas psicotécnicas';
COMMENT ON FUNCTION get_psychometric_system_stats IS 'Estadísticas del sistema de dificultad adaptativa';

-- 9. VERIFICACIÓN FINAL
-- =====================================================
SELECT 'Sistema psicotécnico completado. Ejecuta SELECT get_psychometric_system_stats(); para ver estadísticas.' as status;