-- Arreglar función calculate_personal_difficulty con tipos correctos
-- =====================================================

-- 1. Eliminar función existente si tiene problemas de tipos
DROP FUNCTION IF EXISTS calculate_personal_difficulty(DECIMAL, INTEGER);
DROP FUNCTION IF EXISTS calculate_personal_difficulty(NUMERIC, BIGINT);
DROP FUNCTION IF EXISTS calculate_personal_difficulty(NUMERIC, INTEGER);

-- 2. Crear función con tipos explícitos y casting
CREATE OR REPLACE FUNCTION calculate_personal_difficulty(
    p_success_rate NUMERIC,
    p_total_attempts BIGINT
) RETURNS difficulty_level
LANGUAGE plpgsql
AS $$
BEGIN
    -- Necesita al menos 3 intentos para ser confiable
    IF p_total_attempts < 3 THEN
        RETURN 'medium'::difficulty_level;
    END IF;
    
    -- Algoritmo de clasificación con casting explícito
    IF p_success_rate::DECIMAL >= 0.85 THEN
        RETURN 'easy'::difficulty_level;
    ELSIF p_success_rate::DECIMAL >= 0.65 THEN
        RETURN 'medium'::difficulty_level;
    ELSIF p_success_rate::DECIMAL >= 0.35 THEN
        RETURN 'hard'::difficulty_level;
    ELSE
        RETURN 'extreme'::difficulty_level;
    END IF;
END;
$$;

-- 3. Función de migración corregida con casting explícito
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
        COUNT(*)::INTEGER as total_attempts,
        SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::INTEGER as correct_attempts,
        ROUND(AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END), 2)::DECIMAL(3,2) as success_rate,
        calculate_personal_difficulty(
            AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END)::NUMERIC,
            COUNT(*)::BIGINT
        ) as personal_difficulty,
        MIN(t.completed_at) as first_attempt_at,
        MAX(t.completed_at) as last_attempt_at,
        'stable'::VARCHAR as trend -- Inicial para datos migrados
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

-- 4. Actualizar trigger function con casting correcto
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
            COUNT(*)::INTEGER as total_attempts,
            SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::INTEGER as correct_attempts,
            ROUND(AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END), 2)::DECIMAL(3,2) as success_rate,
            calculate_personal_difficulty(
                AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END)::NUMERIC,
                COUNT(*)::BIGINT
            ) as personal_difficulty,
            MIN(t.completed_at) as first_attempt_at,
            MAX(t.completed_at) as last_attempt_at,
            calculate_trend(t.user_id, NEW.question_id)::VARCHAR as trend
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

-- Comentarios
COMMENT ON FUNCTION calculate_personal_difficulty IS 'Algoritmo para calcular dificultad personal basada en tasa de éxito - versión corregida con tipos explícitos';
COMMENT ON FUNCTION migrate_existing_data IS 'Función de migración corregida con casting de tipos apropiados';