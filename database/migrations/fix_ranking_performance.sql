-- ============================================================================
-- FIX: Optimizar ranking para evitar limit de 100k respuestas
-- Fecha: 2025-11-23
-- Bug: El limit(100000) corta usuarios del ranking mensual
-- Solución: Función RPC que agrega en Postgres (como user_streaks)
-- ============================================================================

-- Crear índices si no existen (mejoran performance)
CREATE INDEX IF NOT EXISTS idx_test_questions_created_at ON test_questions(created_at);
CREATE INDEX IF NOT EXISTS idx_test_questions_test_id ON test_questions(test_id);
CREATE INDEX IF NOT EXISTS idx_tests_user_id ON tests(user_id);

-- ============================================================================
-- FUNCIÓN PRINCIPAL: Obtener ranking por período
-- ============================================================================
CREATE OR REPLACE FUNCTION get_ranking_for_period(
    p_start_date timestamptz,
    p_end_date timestamptz DEFAULT NULL,
    p_min_questions integer DEFAULT 5,
    p_limit integer DEFAULT 100
)
RETURNS TABLE (
    user_id uuid,
    total_questions bigint,
    correct_answers bigint,
    accuracy numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.user_id,
        COUNT(*)::bigint as total_questions,
        COUNT(*) FILTER (WHERE tq.is_correct)::bigint as correct_answers,
        ROUND((COUNT(*) FILTER (WHERE tq.is_correct)::numeric / COUNT(*)) * 100, 0) as accuracy
    FROM test_questions tq
    INNER JOIN tests t ON t.id = tq.test_id
    WHERE
        tq.created_at >= p_start_date
        AND (p_end_date IS NULL OR tq.created_at <= p_end_date)
    GROUP BY t.user_id
    HAVING COUNT(*) >= p_min_questions
    ORDER BY
        accuracy DESC,
        total_questions DESC
    LIMIT p_limit;
END;
$$;

-- Dar permisos a usuarios autenticados
GRANT EXECUTE ON FUNCTION get_ranking_for_period TO authenticated;

COMMENT ON FUNCTION get_ranking_for_period IS 'Ranking optimizado - agrega en Postgres sin límite de respuestas';

-- ============================================================================
-- FUNCIÓN AUXILIAR: Obtener posición del usuario actual
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_ranking_position(
    p_user_id uuid,
    p_start_date timestamptz,
    p_end_date timestamptz DEFAULT NULL,
    p_min_questions integer DEFAULT 5
)
RETURNS TABLE (
    user_rank bigint,
    total_questions bigint,
    correct_answers bigint,
    accuracy numeric,
    total_users_in_ranking bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH user_stats AS (
        SELECT
            t.user_id,
            COUNT(*)::bigint as total_questions,
            COUNT(*) FILTER (WHERE tq.is_correct)::bigint as correct_answers,
            ROUND((COUNT(*) FILTER (WHERE tq.is_correct)::numeric / COUNT(*)) * 100, 0) as accuracy
        FROM test_questions tq
        INNER JOIN tests t ON t.id = tq.test_id
        WHERE
            tq.created_at >= p_start_date
            AND (p_end_date IS NULL OR tq.created_at <= p_end_date)
        GROUP BY t.user_id
        HAVING COUNT(*) >= p_min_questions
    ),
    ranked_users AS (
        SELECT
            *,
            ROW_NUMBER() OVER (ORDER BY accuracy DESC, total_questions DESC) as rank
        FROM user_stats
    )
    SELECT
        ru.rank::bigint as user_rank,
        ru.total_questions,
        ru.correct_answers,
        ru.accuracy,
        (SELECT COUNT(*) FROM ranked_users)::bigint as total_users_in_ranking
    FROM ranked_users ru
    WHERE ru.user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_ranking_position TO authenticated;

COMMENT ON FUNCTION get_user_ranking_position IS 'Obtiene posición exacta de un usuario en el ranking';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
DO $$
DECLARE
    v_count integer;
BEGIN
    -- Test: Contar usuarios con >= 5 preguntas
    SELECT COUNT(*) INTO v_count
    FROM (
        SELECT t.user_id
        FROM test_questions tq
        INNER JOIN tests t ON t.id = tq.test_id
        GROUP BY t.user_id
        HAVING COUNT(*) >= 5
    ) subq;

    RAISE NOTICE '✅ Funciones de ranking creadas exitosamente';
    RAISE NOTICE '   - get_ranking_for_period()';
    RAISE NOTICE '   - get_user_ranking_position()';
    RAISE NOTICE '   - Usuarios con >= 5 preguntas: %', v_count;
END $$;
