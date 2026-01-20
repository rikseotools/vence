-- FIX: Trigger para user_question_history
-- =====================================================
-- PROBLEMA: El trigger actual usa t.is_completed = true, pero cuando se
-- inserta una respuesta en test_questions, el test aún no está completado.
-- Esto causa que siempre falte 1 intento en el historial.
--
-- SOLUCIÓN: Dos opciones:
-- 1. Remover el filtro is_completed (cuenta todos los intentos)
-- 2. Añadir un segundo trigger que se ejecute al completar el test
--
-- Implementamos opción 1 por simplicidad: contar TODOS los intentos
-- independientemente de si el test está completado.
-- =====================================================

-- 1. Actualizar la función del trigger
CREATE OR REPLACE FUNCTION update_user_question_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Solo procesar si es una respuesta completada
    IF NEW.is_correct IS NOT NULL AND NEW.question_id IS NOT NULL THEN
        -- Obtener el user_id del test
        SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id;

        -- Si no encontramos user_id, salir
        IF v_user_id IS NULL THEN
            RETURN NEW;
        END IF;

        -- Verificar que el question_id existe en la tabla questions
        IF NOT EXISTS (SELECT 1 FROM questions WHERE id = NEW.question_id) THEN
            RETURN NEW;
        END IF;

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
            v_user_id,
            NEW.question_id,
            COUNT(*)::INTEGER as total_attempts,
            SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::INTEGER as correct_attempts,
            ROUND(AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END), 2)::DECIMAL(3,2) as success_rate,
            calculate_personal_difficulty(
                AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END)::NUMERIC,
                COUNT(*)::BIGINT
            ) as personal_difficulty,
            MIN(tq.created_at) as first_attempt_at,  -- ✅ Usar tq.created_at en vez de t.completed_at
            MAX(tq.created_at) as last_attempt_at,   -- ✅ Usar tq.created_at en vez de t.completed_at
            'stable'::VARCHAR as trend
        FROM test_questions tq
        JOIN tests t ON t.id = tq.test_id
        WHERE tq.question_id = NEW.question_id
        AND t.user_id = v_user_id
        AND tq.is_correct IS NOT NULL  -- ✅ Solo respuestas válidas, sin filtro is_completed
        GROUP BY v_user_id, NEW.question_id

        ON CONFLICT (user_id, question_id)
        DO UPDATE SET
            total_attempts = EXCLUDED.total_attempts,
            correct_attempts = EXCLUDED.correct_attempts,
            success_rate = EXCLUDED.success_rate,
            personal_difficulty = EXCLUDED.personal_difficulty,
            first_attempt_at = EXCLUDED.first_attempt_at,
            last_attempt_at = EXCLUDED.last_attempt_at,
            trend = EXCLUDED.trend,
            trend_calculated_at = NOW(),
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Asegurar que el trigger existe
DROP TRIGGER IF EXISTS trigger_update_user_question_history ON test_questions;
CREATE TRIGGER trigger_update_user_question_history
    AFTER INSERT OR UPDATE ON test_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_question_history();

-- 3. Función para recalcular historial de un usuario específico (útil para fix manual)
CREATE OR REPLACE FUNCTION recalculate_user_question_history(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    processed_count INTEGER := 0;
BEGIN
    -- Eliminar registros existentes del usuario
    DELETE FROM user_question_history WHERE user_id = p_user_id;

    -- Recalcular desde test_questions
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
        p_user_id,
        tq.question_id,
        COUNT(*)::INTEGER as total_attempts,
        SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::INTEGER as correct_attempts,
        ROUND(AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END), 2)::DECIMAL(3,2) as success_rate,
        calculate_personal_difficulty(
            AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END)::NUMERIC,
            COUNT(*)::BIGINT
        ) as personal_difficulty,
        MIN(tq.created_at) as first_attempt_at,
        MAX(tq.created_at) as last_attempt_at,
        'stable'::VARCHAR as trend
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    WHERE t.user_id = p_user_id
    AND tq.is_correct IS NOT NULL
    AND tq.question_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM questions q WHERE q.id = tq.question_id)
    GROUP BY tq.question_id
    ON CONFLICT (user_id, question_id) DO NOTHING;

    GET DIAGNOSTICS processed_count = ROW_COUNT;
    RETURN processed_count;
END;
$$;

-- 4. Función para recalcular historial de TODOS los usuarios
CREATE OR REPLACE FUNCTION recalculate_all_user_question_history()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    total_processed INTEGER := 0;
    user_processed INTEGER := 0;
    v_user_id UUID;
BEGIN
    FOR v_user_id IN
        SELECT DISTINCT user_id FROM tests WHERE user_id IS NOT NULL
    LOOP
        SELECT recalculate_user_question_history(v_user_id) INTO user_processed;
        total_processed := total_processed + user_processed;
    END LOOP;

    RETURN total_processed;
END;
$$;

-- Comentarios
COMMENT ON FUNCTION update_user_question_history IS 'Trigger function corregida: no depende de is_completed, usa created_at para timestamps';
COMMENT ON FUNCTION recalculate_user_question_history IS 'Recalcula el historial de preguntas de un usuario específico desde test_questions';
COMMENT ON FUNCTION recalculate_all_user_question_history IS 'Recalcula el historial de preguntas de TODOS los usuarios';
