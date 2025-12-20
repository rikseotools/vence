-- =====================================================
-- SISTEMA DE DIFICULTAD ADAPTATIVA PERSONAL
-- Migración para implementar dificultad personalizada
-- =====================================================

-- 1. Enum para niveles de dificultad (crear primero)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty_level') THEN
        CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard', 'extreme');
    END IF;
END $$;

-- 2. Tabla para tracking de respuestas por usuario/pregunta
CREATE TABLE IF NOT EXISTS user_question_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES test_questions(id) ON DELETE CASCADE,
    
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

-- 2. Tabla para métricas agregadas por usuario
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

-- 3. Enum para niveles de dificultad (si no existe)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty_level') THEN
        CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard', 'extreme');
    END IF;
END $$;

-- 4. Función para calcular dificultad personal
CREATE OR REPLACE FUNCTION calculate_personal_difficulty(
    p_success_rate DECIMAL,
    p_total_attempts INTEGER
) RETURNS difficulty_level
LANGUAGE plpgsql
AS $$
BEGIN
    -- Necesita al menos 3 intentos para ser confiable
    IF p_total_attempts < 3 THEN
        RETURN 'medium'::difficulty_level;
    END IF;
    
    -- Algoritmo de clasificación
    IF p_success_rate >= 0.85 THEN
        RETURN 'easy'::difficulty_level;
    ELSIF p_success_rate >= 0.65 THEN
        RETURN 'medium'::difficulty_level;
    ELSIF p_success_rate >= 0.35 THEN
        RETURN 'hard'::difficulty_level;
    ELSE
        RETURN 'extreme'::difficulty_level;
    END IF;
END;
$$;

-- 5. Función para calcular tendencia
CREATE OR REPLACE FUNCTION calculate_trend(
    p_user_id UUID,
    p_question_id UUID
) RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
    recent_success DECIMAL;
    historical_success DECIMAL;
BEGIN
    -- Éxito en últimos 5 intentos vs anteriores
    SELECT 
        COALESCE(AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END), 0)
    INTO recent_success
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    WHERE t.user_id = p_user_id 
    AND tq.question_id = p_question_id
    AND t.completed_at >= NOW() - INTERVAL '30 days'
    ORDER BY t.completed_at DESC
    LIMIT 5;
    
    -- Si no hay suficientes datos
    IF recent_success IS NULL THEN
        RETURN 'stable';
    END IF;
    
    -- Éxito histórico (excluyendo últimos 5)
    SELECT 
        COALESCE(AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END), recent_success)
    INTO historical_success
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    WHERE t.user_id = p_user_id 
    AND tq.question_id = p_question_id
    AND t.completed_at < (
        SELECT t2.completed_at 
        FROM tests t2 
        JOIN test_questions tq2 ON t2.id = tq2.test_id
        WHERE t2.user_id = p_user_id AND tq2.question_id = p_question_id
        ORDER BY t2.completed_at DESC 
        LIMIT 1 OFFSET 5
    );
    
    -- Comparar tendencias
    IF recent_success > historical_success + 0.2 THEN
        RETURN 'improving';
    ELSIF recent_success < historical_success - 0.2 THEN
        RETURN 'declining';
    ELSE
        RETURN 'stable';
    END IF;
END;
$$;

-- 6. Trigger para actualizar user_question_history automáticamente
CREATE OR REPLACE FUNCTION update_user_question_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Solo procesar si es una respuesta completada
    IF NEW.is_correct IS NOT NULL THEN
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
            NEW.question_id,
            COUNT(*) as total_attempts,
            SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) as correct_attempts,
            ROUND(AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END), 2) as success_rate,
            calculate_personal_difficulty(
                AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END),
                COUNT(*)
            ) as personal_difficulty,
            MIN(t.completed_at) as first_attempt_at,
            MAX(t.completed_at) as last_attempt_at,
            calculate_trend(t.user_id, NEW.question_id) as trend
        FROM test_questions tq
        JOIN tests t ON t.id = tq.test_id
        WHERE tq.question_id = NEW.question_id
        AND t.user_id = (SELECT user_id FROM tests WHERE id = NEW.test_id)
        AND t.is_completed = true
        GROUP BY t.user_id, NEW.question_id
        
        ON CONFLICT (user_id, question_id) 
        DO UPDATE SET
            total_attempts = EXCLUDED.total_attempts,
            correct_attempts = EXCLUDED.correct_attempts,
            success_rate = EXCLUDED.success_rate,
            personal_difficulty = EXCLUDED.personal_difficulty,
            last_attempt_at = EXCLUDED.last_attempt_at,
            trend = EXCLUDED.trend,
            trend_calculated_at = NOW(),
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$;

-- 7. Crear trigger
DROP TRIGGER IF EXISTS trigger_update_user_question_history ON test_questions;
CREATE TRIGGER trigger_update_user_question_history
    AFTER INSERT OR UPDATE ON test_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_question_history();

-- 8. Índices para optimización
CREATE INDEX IF NOT EXISTS idx_user_question_history_user_id ON user_question_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_question_history_question_id ON user_question_history(question_id);
CREATE INDEX IF NOT EXISTS idx_user_question_history_difficulty ON user_question_history(personal_difficulty);
CREATE INDEX IF NOT EXISTS idx_user_question_history_success_rate ON user_question_history(success_rate);
CREATE INDEX IF NOT EXISTS idx_user_question_history_trend ON user_question_history(trend);

-- 9. RLS (Row Level Security)
ALTER TABLE user_question_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_difficulty_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Users can view their own question history" ON user_question_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own difficulty metrics" ON user_difficulty_metrics
    FOR SELECT USING (auth.uid() = user_id);

-- 10. Función para migrar datos existentes
CREATE OR REPLACE FUNCTION migrate_existing_data()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    processed_count INTEGER := 0;
BEGIN
    -- Procesar todas las respuestas existentes para calcular dificultad personal
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
        tq.question_id,
        COUNT(*) as total_attempts,
        SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) as correct_attempts,
        ROUND(AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END), 2) as success_rate,
        calculate_personal_difficulty(
            AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END),
            COUNT(*)
        ) as personal_difficulty,
        MIN(t.completed_at) as first_attempt_at,
        MAX(t.completed_at) as last_attempt_at,
        'stable' as trend -- Inicial para datos migrados
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    WHERE t.is_completed = true
    AND tq.is_correct IS NOT NULL
    GROUP BY t.user_id, tq.question_id
    HAVING COUNT(*) >= 1 -- Al menos 1 intento
    ON CONFLICT (user_id, question_id) DO NOTHING;
    
    GET DIAGNOSTICS processed_count = ROW_COUNT;
    RETURN processed_count;
END;
$$;

-- Comentarios finales
COMMENT ON TABLE user_question_history IS 'Historial de respuestas por usuario/pregunta para calcular dificultad personal';
COMMENT ON TABLE user_difficulty_metrics IS 'Métricas agregadas de dificultad por usuario';
COMMENT ON FUNCTION calculate_personal_difficulty IS 'Algoritmo para calcular dificultad personal basada en tasa de éxito';
COMMENT ON FUNCTION calculate_trend IS 'Calcula tendencia de mejora/empeoramiento en pregunta específica';