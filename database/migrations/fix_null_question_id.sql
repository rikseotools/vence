-- Arreglar migración para manejar question_id NULL
-- =====================================================

-- 1. Función de migración corregida con filtro para question_id NULL
CREATE OR REPLACE FUNCTION migrate_existing_data()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    processed_count INTEGER := 0;
BEGIN
    -- Procesar todas las respuestas existentes para calcular dificultad personal
    -- FILTRAR question_id NULL para evitar violación de constraint
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
    AND tq.question_id IS NOT NULL  -- ✅ FILTRO CRÍTICO AGREGADO
    AND t.user_id IS NOT NULL       -- ✅ FILTRO ADICIONAL DE SEGURIDAD
    GROUP BY t.user_id, tq.question_id
    HAVING COUNT(*) >= 1 -- Al menos 1 intento
    ON CONFLICT (user_id, question_id) DO NOTHING;
    
    GET DIAGNOSTICS processed_count = ROW_COUNT;
    RETURN processed_count;
END;
$$;

-- 2. También actualizar el trigger para ser más robusto
CREATE OR REPLACE FUNCTION update_user_question_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Solo procesar si es una respuesta completada Y tiene question_id válido
    IF NEW.is_correct IS NOT NULL AND NEW.question_id IS NOT NULL THEN
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
        AND tq.question_id IS NOT NULL  -- ✅ FILTRO AGREGADO
        AND t.user_id = (SELECT user_id FROM tests WHERE id = NEW.test_id)
        AND t.user_id IS NOT NULL       -- ✅ FILTRO ADICIONAL
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

-- 3. Función de diagnóstico para ver los datos problemáticos (opcional)
CREATE OR REPLACE FUNCTION diagnose_null_question_ids()
RETURNS TABLE(
    total_test_questions BIGINT,
    null_question_ids BIGINT,
    valid_question_ids BIGINT,
    null_percentage DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_test_questions,
        COUNT(*) FILTER (WHERE question_id IS NULL) as null_question_ids,
        COUNT(*) FILTER (WHERE question_id IS NOT NULL) as valid_question_ids,
        ROUND(
            (COUNT(*) FILTER (WHERE question_id IS NULL) * 100.0 / COUNT(*))::DECIMAL, 2
        ) as null_percentage
    FROM test_questions;
END;
$$;

-- Comentarios
COMMENT ON FUNCTION migrate_existing_data IS 'Función de migración robusta que maneja question_id NULL correctamente';
COMMENT ON FUNCTION diagnose_null_question_ids IS 'Función de diagnóstico para analizar datos con question_id NULL';