-- ============================================================================
-- SISTEMA DE RANKING OPTIMIZADO
-- Similar al sistema de user_streaks pero para estadísticas de respuestas
-- ============================================================================

-- Opción 1: Vista simple (se recalcula cada vez, pero rápido porque es en Postgres)
CREATE OR REPLACE VIEW user_ranking_stats AS
SELECT
    t.user_id,
    COUNT(*)::bigint as total_questions,
    COUNT(*) FILTER (WHERE tq.is_correct)::bigint as correct_answers,
    ROUND((COUNT(*) FILTER (WHERE tq.is_correct)::numeric / COUNT(*)) * 100, 0) as accuracy,
    MAX(tq.created_at) as last_activity
FROM test_questions tq
INNER JOIN tests t ON t.id = tq.test_id
GROUP BY t.user_id;

COMMENT ON VIEW user_ranking_stats IS 'Estadísticas agregadas por usuario para ranking';

-- Crear índices en las tablas base para optimizar la vista
CREATE INDEX IF NOT EXISTS idx_test_questions_test_id
ON test_questions(test_id);

CREATE INDEX IF NOT EXISTS idx_test_questions_created_at
ON test_questions(created_at);

CREATE INDEX IF NOT EXISTS idx_test_questions_is_correct
ON test_questions(is_correct);

CREATE INDEX IF NOT EXISTS idx_tests_user_id
ON tests(user_id);

-- ============================================================================
-- FUNCIÓN RPC OPTIMIZADA PARA RANKING POR PERÍODO
-- Esta es la que usaremos en RankingModal.js
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

-- Dar permisos
GRANT EXECUTE ON FUNCTION get_ranking_for_period TO authenticated;

COMMENT ON FUNCTION get_ranking_for_period IS 'Obtiene ranking de usuarios por período de tiempo con mínimo de preguntas';

-- ============================================================================
-- FUNCIÓN AUXILIAR: Obtener ranking completo del usuario actual
-- Incluye la posición del usuario aunque no esté en el top
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

COMMENT ON FUNCTION get_user_ranking_position IS 'Obtiene la posición de un usuario específico en el ranking';

-- ============================================================================
-- ESTADÍSTICAS DE VERIFICACIÓN
-- ============================================================================

-- Verificar que las funciones se crearon correctamente
DO $$
DECLARE
    v_count integer;
BEGIN
    -- Contar usuarios con al menos 5 respuestas
    SELECT COUNT(DISTINCT t.user_id) INTO v_count
    FROM test_questions tq
    INNER JOIN tests t ON t.id = tq.test_id
    GROUP BY t.user_id
    HAVING COUNT(*) >= 5;

    RAISE NOTICE '✅ Sistema de ranking optimizado creado';
    RAISE NOTICE '   - Vista: user_ranking_stats';
    RAISE NOTICE '   - Función: get_ranking_for_period()';
    RAISE NOTICE '   - Función: get_user_ranking_position()';
    RAISE NOTICE '   - Usuarios con >= 5 preguntas: %', v_count;
    RAISE NOTICE '';
    RAISE NOTICE '📝 Uso en código JavaScript:';
    RAISE NOTICE '   const { data } = await supabase.rpc(''get_ranking_for_period'', {';
    RAISE NOTICE '     p_start_date: ''2025-01-20T00:00:00Z'',';
    RAISE NOTICE '     p_min_questions: 5,';
    RAISE NOTICE '     p_limit: 100';
    RAISE NOTICE '   })';
END $$;
