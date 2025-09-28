-- Arreglar foreign key constraint y migración
-- =====================================================

-- 1. Eliminar la tabla existente para recrearla con FK correcta
DROP TABLE IF EXISTS user_question_history CASCADE;
DROP TABLE IF EXISTS user_difficulty_metrics CASCADE;

-- 2. Recrear tabla con FK correcta (apuntando a 'questions' no 'test_questions')
CREATE TABLE IF NOT EXISTS user_question_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,  -- ✅ CORREGIDO: apunta a 'questions'
    
    -- Tracking de intentos
    total_attempts INTEGER DEFAULT 0,
    correct_attempts INTEGER DEFAULT 0,
    
    -- Métricas calculadas
    success_rate DECIMAL(3,2) DEFAULT 0.00, -- 0.00 a 1.00
    personal_difficulty difficulty_level DEFAULT 'medium',
    
    -- Análisis temporal
    first_attempt_at TIMESTAMP WITH TIME ZONE,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    
    -- Tendencias
    trend VARCHAR(20) DEFAULT 'stable', -- 'improving', 'declining', 'stable'
    trend_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Índices únicos
    UNIQUE(user_id, question_id)
);

-- 3. Recrear tabla de métricas
CREATE TABLE IF NOT EXISTS user_difficulty_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Métricas globales de dificultad
    avg_personal_difficulty DECIMAL(3,2) DEFAULT 2.50, -- 1.00=easy, 4.00=extreme
    total_questions_attempted INTEGER DEFAULT 0,
    questions_mastered INTEGER DEFAULT 0, -- success_rate >= 0.8
    questions_struggling INTEGER DEFAULT 0, -- success_rate <= 0.3
    
    -- Progreso temporal
    difficulty_improved_this_week INTEGER DEFAULT 0,
    difficulty_declined_this_week INTEGER DEFAULT 0,
    
    -- Última actualización
    last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- 4. Índices para optimización
CREATE INDEX IF NOT EXISTS idx_user_question_history_user_id ON user_question_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_question_history_question_id ON user_question_history(question_id);
CREATE INDEX IF NOT EXISTS idx_user_question_history_difficulty ON user_question_history(personal_difficulty);
CREATE INDEX IF NOT EXISTS idx_user_question_history_success_rate ON user_question_history(success_rate);
CREATE INDEX IF NOT EXISTS idx_user_question_history_trend ON user_question_history(trend);

-- 5. RLS (Row Level Security)
ALTER TABLE user_question_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_difficulty_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Users can view their own question history" ON user_question_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own difficulty metrics" ON user_difficulty_metrics
    FOR SELECT USING (auth.uid() = user_id);

-- 6. Función de migración corregida - ahora usando la tabla 'questions' correcta
CREATE OR REPLACE FUNCTION migrate_existing_data()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    processed_count INTEGER := 0;
BEGIN
    -- Migrar datos agrupando por question_id real (de la tabla questions)
    INSERT INTO user_question_history (
        user_id,
        question_id,
        total_attempts,
        correct_attempts,
        success_rate,
        personal_difficulty,
        first_attempt_at,
        last_attempt_at,
        trend
    )
    SELECT 
        t.user_id,
        tq.question_id,  -- Este question_id debe existir en la tabla 'questions'
        COUNT(*)::INTEGER as total_attempts,
        SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::INTEGER as correct_attempts,
        ROUND(AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END), 2)::DECIMAL(3,2) as success_rate,
        calculate_personal_difficulty(
            AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END)::NUMERIC,
            COUNT(*)::BIGINT
        ) as personal_difficulty,
        MIN(t.completed_at) as first_attempt_at,
        MAX(t.completed_at) as last_attempt_at,
        'stable'::VARCHAR as trend
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    WHERE t.is_completed = true
    AND tq.is_correct IS NOT NULL
    AND tq.question_id IS NOT NULL
    AND t.user_id IS NOT NULL
    -- ✅ FILTRO CRÍTICO: Solo question_id que existen en la tabla questions
    AND EXISTS (SELECT 1 FROM questions q WHERE q.id = tq.question_id)
    GROUP BY t.user_id, tq.question_id
    HAVING COUNT(*) >= 1
    ON CONFLICT (user_id, question_id) DO NOTHING;
    
    GET DIAGNOSTICS processed_count = ROW_COUNT;
    RETURN processed_count;
END;
$$;

-- 7. Recrear trigger con FK correcta
DROP TRIGGER IF EXISTS trigger_update_user_question_history ON test_questions;
CREATE TRIGGER trigger_update_user_question_history
    AFTER INSERT OR UPDATE ON test_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_question_history();

-- 8. Función de diagnóstico mejorada
CREATE OR REPLACE FUNCTION diagnose_question_references()
RETURNS TABLE(
    total_test_questions BIGINT,
    null_question_ids BIGINT,
    valid_references BIGINT,
    invalid_references BIGINT,
    valid_percentage DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_test_questions,
        COUNT(*) FILTER (WHERE tq.question_id IS NULL) as null_question_ids,
        COUNT(*) FILTER (WHERE tq.question_id IS NOT NULL AND EXISTS (SELECT 1 FROM questions q WHERE q.id = tq.question_id)) as valid_references,
        COUNT(*) FILTER (WHERE tq.question_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.id = tq.question_id)) as invalid_references,
        ROUND(
            (COUNT(*) FILTER (WHERE tq.question_id IS NOT NULL AND EXISTS (SELECT 1 FROM questions q WHERE q.id = tq.question_id)) * 100.0 / COUNT(*))::DECIMAL, 2
        ) as valid_percentage
    FROM test_questions tq;
END;
$$;

-- Comentarios
COMMENT ON TABLE user_question_history IS 'Historial de respuestas por usuario/pregunta para calcular dificultad personal - FK corregida';
COMMENT ON FUNCTION migrate_existing_data IS 'Función de migración con validación de FK a tabla questions';
COMMENT ON FUNCTION diagnose_question_references IS 'Diagnóstico de referencias válidas a tabla questions';